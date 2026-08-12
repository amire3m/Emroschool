import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const gitBash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/bash";

function bashPath(value: string) {
  return process.platform === "win32"
    ? `/${value[0].toLowerCase()}${value.slice(2).replace(/\\/g, "/")}`
    : value;
}

async function executable(filePath: string, content: string) {
  await writeFile(filePath, `#!/usr/bin/env bash\n${content}\n`);
  await chmod(filePath, 0o755);
}

async function deploymentFixture({
  failingCopy = false,
  failingCommand,
  appUser = "deploy-user",
  appDir,
  lockFile,
  lockDir,
  logDir,
  realFlock = false,
  longLivedPm2Child = false,
  blockDispatch = false,
}: {
  failingCopy?: boolean;
  failingCommand?: "npm-ci" | "db-push" | "build" | "pm2-restart" | "reconcile" | "dispatch" | "cron-install";
  appUser?: string;
  appDir?: string;
  lockFile?: string;
  lockDir?: string;
  logDir?: string;
  realFlock?: boolean;
  longLivedPm2Child?: boolean;
  blockDispatch?: boolean;
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "deploy-safe-"));
  const app = appDir ?? path.join(root, "app");
  const bin = path.join(root, "bin");
  await mkdir(path.join(app, "prisma"), { recursive: true });
  await mkdir(path.join(app, "node_modules", "tsx", "dist"), { recursive: true });
  await mkdir(path.join(app, "scripts"), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(app, "prisma", "dev.db"), "sqlite");
  await writeFile(path.join(app, "node_modules", "tsx", "dist", "cli.mjs"), "// fixture\n");
  await writeFile(path.join(app, "scripts", "load-bale-app-env.cjs"), "// fixture\n");
  await writeFile(path.join(app, "scripts", "reconcile-bale-release-events.ts"), "// fixture\n");
  await writeFile(path.join(app, "scripts", "dispatch-bale-group-events.ts"), "// fixture\n");
  await writeFile(path.join(app, ".env"), "BALE_BOT_TOKEN=fixture-secret\nBALE_COORDINATION_CHAT_ID=fixture-chat\n");
  const log = path.join(root, "commands.log").replace(/\\/g, "/");
  const cronFile = path.join(root, "cron.d", "emroschool-bale-notifications");
  const resolvedLockDir = lockDir ?? path.join(root, "lock");
  const resolvedLogDir = logDir ?? path.join(root, "log");
  const resolvedLockFile = lockFile ?? path.join(resolvedLockDir, "notifications.lock");
  const notificationLog = path.join(resolvedLogDir, "notifications.log");
  const dispatchReady = path.join(root, "dispatch-ready");
  const dispatchGate = path.join(root, "dispatch-gate");
  const pm2ChildPid = path.join(root, "pm2-child.pid");
  await mkdir(path.dirname(cronFile), { recursive: true });
  await mkdir(resolvedLockDir, { recursive: true });
  await mkdir(resolvedLogDir, { recursive: true });
  const original = await readFile(path.join(process.cwd(), "deploy-safe.sh"), "utf8");
  const script = original.replace(/^APP_DIR=.*$/m, 'APP_DIR="${APP_DIR:-/var/www/Emroschool}"');
  const scriptPath = path.join(root, "deploy-safe.sh");
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);

  await executable(path.join(bin, "pm2"), `printf 'pm2 %s\\n' "$*" >> "${log}"\n${longLivedPm2Child ? `if [[ "$1" == "restart" ]]; then sleep 300 </dev/null >/dev/null 2>&1 & printf '%s\\n' "$!" > "${bashPath(pm2ChildPid)}"; fi` : ":"}\n${failingCommand === "pm2-restart" ? '[[ "$1" == "restart" ]] && exit 35\n:' : ":"}`);
  await executable(path.join(bin, "git"), `printf 'git %s\\n' "$*" >> "${log}"`);
  await executable(path.join(bin, "npm"), `printf 'npm %s\\n' "$*" >> "${log}"\n${failingCommand === "npm-ci" ? '[[ "$*" == "ci" ]] && exit 31' : failingCommand === "build" ? '[[ "$*" == "run build" ]] && exit 33' : ":"}`);
  await executable(path.join(bin, "npx"), `printf 'npx %s\\n' "$*" >> "${log}"\n${failingCommand === "db-push" ? '[[ "$*" == "prisma db push" ]] && exit 32' : ":"}`);
  await writeFile(path.join(bin, "node"), `#!/usr/bin/bash\nprintf 'node user=%s inherited=%s token=%s chat=%s args=%s\\n' "$TEST_EXEC_USER" "$DEPLOY_ONLY_SECRET" "$BALE_BOT_TOKEN" "$BALE_COORDINATION_CHAT_ID" "$*" >> "${log}"\n${blockDispatch ? `if [[ "$*" == *"dispatch-bale-group-events.ts"* ]]; then printf ready > "${bashPath(dispatchReady)}"; while [[ ! -e "${bashPath(dispatchGate)}" ]]; do sleep 0.01; done; fi` : ":"}\n${failingCommand === "reconcile" ? '[[ "$*" == *"reconcile-bale-release-events.ts"* ]] && exit 36' : failingCommand === "dispatch" ? '[[ "$*" == *"dispatch-bale-group-events.ts"* ]] && exit 37' : ":"}\n`);
  await chmod(path.join(bin, "node"), 0o755);
  if (!realFlock) {
    await executable(path.join(bin, "flock"), `printf 'flock %s\\n' "$*" >> "${log}"\n[[ "$1" == "--close" || "$1" == "-n" ]] && shift\nlock="$1"\nshift\n[[ "$#" -eq 0 ]] && exit 0\nexec "$@"`);
  }
  await executable(path.join(bin, "runuser"), `printf 'runuser %s\\n' "$*" >> "${log}"\n[[ "$1" == "-u" ]] || exit 41\nuser="$2"\nshift 3\nexport TEST_EXEC_USER="$user"\nexec "$@"`);
  await executable(path.join(bin, "id"), `[[ "$1" == "-u" && "$2" == "missing-user" ]] && exit 42\n[[ "$1" == "-gn" ]] && { printf 'deploy-group\\n'; exit; }\nprintf '1000\\n'`);
  await executable(path.join(bin, "stat"), `format="$2"\ntarget="\${*: -1}"\n[[ "$format" == "%U" ]] && { printf 'deploy-user\\n'; exit; }\nif [[ "$target" == *"unsafe-parent"* ]]; then printf 'root 777 directory\\n'; elif [[ -L "$target" ]]; then printf 'deploy-user 777 symbolic link\\n'; elif [[ -d "$target" ]]; then printf 'root 755 directory\\n'; else printf 'deploy-user 640 regular file\\n'; fi`);
  await executable(path.join(bin, "install"), `args=("$@")\nif [[ "$1" == "-d" ]]; then target="\${args[-1]}"; mkdir -p "$target"; exit; fi\ntarget="\${args[-1]}"; : > "$target"`);
  await executable(path.join(bin, "chown"), `printf 'chown %s\\n' "$*" >> "${log}"`);
  await executable(path.join(bin, "mv"), `printf 'mv %s\\n' "$*" >> "${log}"\n${failingCommand === "cron-install" ? `[[ "\${*: -1}" == "${bashPath(cronFile)}" ]] && exit 34` : ":"}\nexec /usr/bin/mv "$@"`);
  await executable(path.join(bin, "sqlite3"), `printf 'sqlite3 %s\\n' "$*" >> "${log}"`);
  await executable(path.join(bin, "date"), "printf 'test-stamp\\n'");
  if (failingCopy) {
    await executable(path.join(bin, "cp"), `if [[ "$1" == "prisma/dev.db" ]]; then exit 23; fi\nexec /usr/bin/cp "$@"`);
  }
  return {
    root,
    app,
    bin,
    log,
    cronFile,
    lockFile: resolvedLockFile,
    lockDir: resolvedLockDir,
    logDir: resolvedLogDir,
    notificationLog,
    dispatchReady,
    dispatchGate,
    pm2ChildPid,
    scriptPath,
    appForBash: bashPath(app),
    binForBash: bashPath(bin),
    appUser,
  };
}

async function waitForFile(filePath: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(filePath)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function runDeployment(fixture: Awaited<ReturnType<typeof deploymentFixture>>, overrides: Record<string, string> = {}) {
  const exports = Object.entries(overrides).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
  return execFileAsync(gitBash, [
    "-c",
    `export PATH="$1:/usr/bin:/bin" APP_DIR="$2" CRON_FILE="$4" BALE_LOCK_DIR="$5" BALE_LOG_DIR="$6" APP_USER="$7" ${exports}; exec "$3"`,
    "deploy-test",
    fixture.binForBash,
    fixture.appForBash,
    bashPath(fixture.scriptPath),
    bashPath(fixture.cronFile),
    bashPath(fixture.lockDir),
    bashPath(fixture.logDir),
    fixture.appUser,
  ]);
}

async function runInstalledCron(fixture: Awaited<ReturnType<typeof deploymentFixture>>) {
  const cron = await readFile(fixture.cronFile, "utf8");
  const line = cron.split("\n").find((candidate) => candidate.startsWith("* * * * * "))!;
  const command = line.split(" ").slice(6).join(" ");
  return execFileAsync(gitBash, ["-c", 'exec env -i PATH=/usr/bin:/bin TEST_EXEC_USER="$1" "$2" -c "$3"', "cron-test", fixture.appUser, gitBash, command]);
}

test("deployment restarts PM2 when the stopped database backup fails", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCopy: true });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /pm2 stop emroschool/);
    assert.match(commands, /pm2 restart emroschool/);
    assert.doesNotMatch(commands, /git pull/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment checkpoints SQLite, preserves journals, and backfills after db push", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  try {
    await writeFile(path.join(fixture.app, "prisma", "dev.db-wal"), "wal");
    await writeFile(path.join(fixture.app, "prisma", "dev.db-shm"), "shm");
    await runDeployment(fixture);
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /sqlite3 prisma\/dev.db PRAGMA wal_checkpoint\(TRUNCATE\);/);
    assert.ok(existsSync(path.join(fixture.app, "backups")));
    assert.ok(existsSync(path.join(fixture.app, "backups", "test-stamp", "dev.db-wal")));
    assert.ok(commands.indexOf("npx prisma db push") < commands.indexOf("npm run db:backfill-bale-payments"));
    assert.ok(commands.indexOf("npm run db:backfill-bale-payments") < commands.indexOf("npm run build"));
    const stop = commands.indexOf("pm2 stop emroschool");
    const dbPush = commands.indexOf("npx prisma db push");
    const restart = commands.indexOf("pm2 restart emroschool");
    assert.ok(stop >= 0 && dbPush > stop && restart > dbPush);
    assert.equal(commands.slice(stop, dbPush).includes("pm2 restart emroschool"), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment leaves PM2 stopped when dependency installation makes restart unsafe", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "npm-ci" });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /pm2 stop emroschool/);
    assert.doesNotMatch(commands, /pm2 restart emroschool/);
    assert.doesNotMatch(commands, /npx prisma db push/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment never restarts incompatible code when schema push fails", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "db-push" });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /npx prisma db push/);
    assert.doesNotMatch(commands, /npm run db:backfill-bale-payments/);
    assert.doesNotMatch(commands, /pm2 restart emroschool/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment reconciles and dispatches only after a successful build and restart", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  try {
    await runDeployment(fixture, { DEPLOY_ONLY_SECRET: "must-not-leak" });
    const commands = await readFile(fixture.log, "utf8");
    const build = commands.indexOf("npm run build");
    const restart = commands.indexOf("pm2 restart emroschool");
    const reconcile = commands.indexOf("reconcile-bale-release-events.ts");
    const dispatch = commands.indexOf("dispatch-bale-group-events.ts");
    assert.ok(build >= 0 && restart > build && reconcile > restart && dispatch > reconcile);
    assert.match(commands, /flock --close .*notifications\.lock .*deploy-safe\.sh/);
    assert.match(commands, /runuser -u deploy-user -- .*node/);
    assert.match(commands, /runuser -u deploy-user -- .*env -i .*dispatch-bale-group-events\.ts/);
    assert.match(commands, /node user= inherited= token= chat= .*dispatch-bale-group-events\.ts/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment installs an idempotent secret-free root cron using absolute paths and the dispatch lock", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  try {
    await runDeployment(fixture);
    const firstCron = await readFile(fixture.cronFile, "utf8");
    await runDeployment(fixture);
    const secondCron = await readFile(fixture.cronFile, "utf8");

    assert.equal(secondCron, firstCron);
    assert.match(firstCron, /^\* \* \* \* \* deploy-user /m);
    assert.match(firstCron, /\/flock -n /);
    assert.doesNotMatch(firstCron, /\/bash|\/npm|\.env/);
    assert.match(firstCron, /\/node .*tsx.*dispatch-bale-group-events\.ts/);
    assert.match(firstCron, />\/dev\/null 2>>.*notifications\.log/);
    assert.match(firstCron, new RegExp(bashPath(fixture.lockFile).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(firstCron, /fixture-secret|fixture-chat/);

    await runInstalledCron(fixture);
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /flock -n .*notifications\.lock .*node/);
    assert.match(commands, /node user=deploy-user inherited= token= chat= .*dispatch-bale-group-events\.ts/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment does not reconcile or install notifications when the build fails", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "build" });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.doesNotMatch(commands, /reconcile-bale-release-events|dispatch-bale-group-events/);
    assert.equal(existsSync(fixture.cronFile), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("notification setup failure is reported after PM2 is safely restarted", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "cron-install" });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /pm2 restart emroschool/);
    assert.match(commands, /reconcile-bale-release-events/);
    assert.match(commands, /dispatch-bale-group-events/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment rejects unsafe Cron users and injected path syntax before stopping PM2", { skip: !existsSync(gitBash) }, async () => {
  const unsafeOverrides: Record<string, string>[] = [
    { APP_USER: "deploy-user root" },
    { APP_USER: "deploy-user\n* * * * * root evil" },
    { APP_USER: "missing-user" },
    { BALE_LOCK_DIR: "/tmp/lock%0a" },
    { BALE_LOG_DIR: "relative" },
    { BALE_LOCK_BASENAME: "." },
    { BALE_LOG_BASENAME: ".." },
    { BALE_LOCK_BASENAME: "nested/file" },
  ];
  for (const overrides of unsafeOverrides) {
    const fixture = await deploymentFixture();
    try {
      await assert.rejects(runDeployment(fixture, overrides));
      const commands = existsSync(fixture.log) ? await readFile(fixture.log, "utf8") : "";
      assert.doesNotMatch(commands, /pm2 stop/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("deployment rejects a writable Cron parent before stopping PM2", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  const unsafeParent = path.join(fixture.root, "unsafe-parent");
  try {
    await mkdir(unsafeParent);
    await assert.rejects(runDeployment(fixture, { CRON_FILE: bashPath(path.join(unsafeParent, "cron")) }));
    const commands = existsSync(fixture.log) ? await readFile(fixture.log, "utf8") : "";
    assert.doesNotMatch(commands, /pm2 stop/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment rejects symlink lock and log targets without changing their victims", { skip: !existsSync(gitBash) || process.platform === "win32" }, async () => {
  for (const target of ["lock", "log"] as const) {
    const fixture = await deploymentFixture();
    const victim = path.join(fixture.root, `${target}-victim`);
    const link = target === "lock" ? fixture.lockFile : fixture.notificationLog;
    try {
      await writeFile(victim, "protected");
      await symlink(victim, link);
      await assert.rejects(runDeployment(fixture));
      assert.equal(await readFile(victim, "utf8"), "protected");
      const commands = existsSync(fixture.log) ? await readFile(fixture.log, "utf8") : "";
      assert.doesNotMatch(commands, /pm2 stop/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("all restart-unsafe and post-restart failures leave the old Cron disabled", { skip: !existsSync(gitBash) }, async () => {
  const failures = ["npm-ci", "db-push", "build", "pm2-restart", "reconcile", "dispatch", "cron-install"] as const;
  for (const failingCommand of failures) {
    const fixture = await deploymentFixture({ failingCommand });
    try {
      await writeFile(fixture.cronFile, "old cron\n");
      await assert.rejects(runDeployment(fixture));
      const commands = existsSync(fixture.log) ? await readFile(fixture.log, "utf8") : "";
      assert.equal(existsSync(fixture.cronFile), false, `${failingCommand}\n${commands}`);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("a successful deployment replaces an old Cron", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  try {
    await writeFile(fixture.cronFile, "old cron\n");
    await runDeployment(fixture);
    const cron = await readFile(fixture.cronFile, "utf8");
    assert.notEqual(cron, "old cron\n");
    assert.match(cron, /dispatch-bale-group-events\.ts/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("real flock excludes a contender until the holder exits", { skip: !existsSync(gitBash) }, async (t) => {
  const probe = await execFileAsync(gitBash, ["-lc", "command -v flock || true"]);
  const flock = probe.stdout.trim();
  if (!flock) return t.skip("real flock is unavailable in this environment");

  const root = await mkdtemp(path.join(tmpdir(), "real-flock-"));
  const lock = bashPath(path.join(root, "lock"));
  const ready = path.join(root, "ready");
  const holder = spawn(gitBash, ["-c", `exec 9>"${lock}"; "${flock}" 9; printf ready >"${bashPath(ready)}"; sleep 30`]);
  try {
    while (!existsSync(ready)) await new Promise((resolve) => setTimeout(resolve, 10));
    await assert.rejects(execFileAsync(gitBash, ["-c", `"${flock}" -n "${lock}" true`]));
    holder.kill();
    await new Promise((resolve) => holder.once("exit", resolve));
    await execFileAsync(gitBash, ["-c", `"${flock}" -n "${lock}" true`]);
  } finally {
    holder.kill();
    await rm(root, { recursive: true, force: true });
  }
});

test("actual deploy holds its real lock through dispatch and releases it despite a live PM2 descendant", { skip: process.platform !== "linux" }, async (t) => {
  const probe = await execFileAsync("/bin/sh", ["-c", "command -v flock || true"]);
  const flock = probe.stdout.trim();
  if (!flock) return t.skip("real flock is unavailable");

  const fixture = await deploymentFixture({ realFlock: true, longLivedPm2Child: true, blockDispatch: true });
  let deployment: ReturnType<typeof runDeployment> | undefined;
  let descendantPid: number | undefined;
  try {
    deployment = runDeployment(fixture);
    await waitForFile(fixture.dispatchReady);
    await waitForFile(fixture.pm2ChildPid);
    descendantPid = Number((await readFile(fixture.pm2ChildPid, "utf8")).trim());
    process.kill(descendantPid, 0);

    await assert.rejects(execFileAsync(flock, ["-n", fixture.lockFile, "true"]));

    await writeFile(fixture.dispatchGate, "release\n");
    await deployment;
    await execFileAsync(flock, ["-n", fixture.lockFile, "true"]);
    process.kill(descendantPid, 0);
  } finally {
    await writeFile(fixture.dispatchGate, "release\n").catch(() => undefined);
    await deployment?.catch(() => undefined);
    if (descendantPid !== undefined) {
      try {
        process.kill(descendantPid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("actual deploy releases its real lock after failure", { skip: process.platform !== "linux" }, async (t) => {
  const probe = await execFileAsync("/bin/sh", ["-c", "command -v flock || true"]);
  const flock = probe.stdout.trim();
  if (!flock) return t.skip("real flock is unavailable");

  const fixture = await deploymentFixture({ realFlock: true, failingCommand: "dispatch" });
  try {
    await assert.rejects(runDeployment(fixture));
    await execFileAsync(flock, ["-n", fixture.lockFile, "true"]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("a backup failure preserves the old Cron after releasing the deployment lock", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCopy: true });
  try {
    await writeFile(fixture.cronFile, "old cron\n");
    await assert.rejects(runDeployment(fixture));
    assert.equal(await readFile(fixture.cronFile, "utf8"), "old cron\n");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment canonicalizes APP_DIR and rejects percent or newline in Cron paths", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture();
  try {
    await runDeployment(fixture, { APP_DIR: `${fixture.appForBash}/../app` });
    const cron = await readFile(fixture.cronFile, "utf8");
    assert.match(cron, new RegExp(bashPath(fixture.app).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(cron, /\.\.\/app/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("an old Cron stays blocked and disabled if post-restart notification setup fails", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "cron-install" });
  try {
    await writeFile(fixture.cronFile, "old cron\n");
    await assert.rejects(runDeployment(fixture));
    assert.equal(existsSync(fixture.cronFile), false);
    const commands = await readFile(fixture.log, "utf8");
    assert.ok(commands.indexOf("flock ") < commands.indexOf("git pull"));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
