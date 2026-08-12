import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
}: {
  failingCopy?: boolean;
  failingCommand?: "npm-ci" | "db-push" | "build" | "cron-install";
  appUser?: string;
  appDir?: string;
  lockFile?: string;
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
  const resolvedLockFile = lockFile ?? path.join(root, "bale-notifications.lock");
  const notificationLog = path.join(root, "bale-notifications.log");
  await mkdir(path.dirname(cronFile), { recursive: true });
  const original = await readFile(path.join(process.cwd(), "deploy-safe.sh"), "utf8");
  const script = original.replace(/^APP_DIR=.*$/m, 'APP_DIR="${APP_DIR:-/var/www/Emroschool}"');
  const scriptPath = path.join(root, "deploy-safe.sh");
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);

  await executable(path.join(bin, "pm2"), `printf 'pm2 %s\\n' "$*" >> "${log}"`);
  await executable(path.join(bin, "git"), `printf 'git %s\\n' "$*" >> "${log}"`);
  await executable(path.join(bin, "npm"), `printf 'npm %s\\n' "$*" >> "${log}"\n${failingCommand === "npm-ci" ? '[[ "$*" == "ci" ]] && exit 31' : failingCommand === "build" ? '[[ "$*" == "run build" ]] && exit 33' : ":"}`);
  await executable(path.join(bin, "npx"), `printf 'npx %s\\n' "$*" >> "${log}"\n${failingCommand === "db-push" ? '[[ "$*" == "prisma db push" ]] && exit 32' : ":"}`);
  await writeFile(path.join(bin, "node"), `#!/usr/bin/bash\nprintf 'node user=%s inherited=%s token=%s chat=%s args=%s\\n' "$TEST_EXEC_USER" "$DEPLOY_ONLY_SECRET" "$BALE_BOT_TOKEN" "$BALE_COORDINATION_CHAT_ID" "$*" >> "${log}"\n`);
  await chmod(path.join(bin, "node"), 0o755);
  await executable(path.join(bin, "flock"), `printf 'flock %s\\n' "$*" >> "${log}"\n[[ "$1" == "-n" ]] && shift\nlock="$1"\nshift\n[[ "$#" -eq 0 ]] && exit 0\nexec "$@"`);
  await executable(path.join(bin, "runuser"), `printf 'runuser %s\\n' "$*" >> "${log}"\n[[ "$1" == "-u" ]] || exit 41\nuser="$2"\nshift 3\nexport TEST_EXEC_USER="$user"\nexec "$@"`);
  await executable(path.join(bin, "id"), `[[ "$1" == "-u" && "$2" == "missing-user" ]] && exit 42\nprintf '1000\\n'`);
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
    notificationLog,
    scriptPath,
    appForBash: bashPath(app),
    binForBash: bashPath(bin),
    appUser,
  };
}

function runDeployment(fixture: Awaited<ReturnType<typeof deploymentFixture>>, overrides: Record<string, string> = {}) {
  const exports = Object.entries(overrides).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
  return execFileAsync(gitBash, [
    "-c",
    `export PATH="$1:/usr/bin:/bin" APP_DIR="$2" CRON_FILE="$4" BALE_LOCK_FILE="$5" BALE_LOG_FILE="$6" APP_USER="$7" ${exports}; exec "$3"`,
    "deploy-test",
    fixture.binForBash,
    fixture.appForBash,
    bashPath(fixture.scriptPath),
    bashPath(fixture.cronFile),
    bashPath(fixture.lockFile),
    bashPath(fixture.notificationLog),
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
    assert.match(firstCron, />\/dev\/null 2>>.*bale-notifications\.log/);
    assert.match(firstCron, new RegExp(bashPath(fixture.lockFile).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(firstCron, /fixture-secret|fixture-chat/);

    await runInstalledCron(fixture);
    const commands = await readFile(fixture.log, "utf8");
    assert.match(commands, /flock -n .*bale-notifications\.lock .*node/);
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
    { BALE_LOCK_FILE: "/tmp/lock%0a" },
    { BALE_LOG_FILE: "relative.log" },
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
