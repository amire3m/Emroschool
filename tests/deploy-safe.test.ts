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
}: {
  failingCopy?: boolean;
  failingCommand?: "npm-ci" | "db-push" | "build" | "cron-install";
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "deploy-safe-"));
  const app = path.join(root, "app");
  const bin = path.join(root, "bin");
  await mkdir(path.join(app, "prisma"), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(app, "prisma", "dev.db"), "sqlite");
  await writeFile(path.join(app, ".env"), "BALE_BOT_TOKEN=fixture-secret\nBALE_COORDINATION_CHAT_ID=fixture-chat\n");
  const log = path.join(root, "commands.log").replace(/\\/g, "/");
  const cronFile = path.join(root, "cron.d", "emroschool-bale-notifications");
  const lockFile = path.join(root, "bale-notifications.lock");
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
  await executable(path.join(bin, "flock"), `printf 'flock %s\\n' "$*" >> "${log}"\n[[ "$1" == "-n" ]] && shift\nshift\nexec "$@"`);
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
    lockFile,
    notificationLog,
    scriptPath,
    appForBash: bashPath(app),
    binForBash: bashPath(bin),
  };
}

function runDeployment(fixture: Awaited<ReturnType<typeof deploymentFixture>>) {
  return execFileAsync(gitBash, [
    "-c",
    'export PATH="$1:/usr/bin:/bin" APP_DIR="$2" CRON_FILE="$4" BALE_LOCK_FILE="$5" BALE_LOG_FILE="$6" APP_USER=deploy-user; exec "$3"',
    "deploy-test",
    fixture.binForBash,
    fixture.appForBash,
    bashPath(fixture.scriptPath),
    bashPath(fixture.cronFile),
    bashPath(fixture.lockFile),
    bashPath(fixture.notificationLog),
  ]);
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
    await runDeployment(fixture);
    const commands = await readFile(fixture.log, "utf8");
    const build = commands.indexOf("npm run build");
    const restart = commands.indexOf("pm2 restart emroschool");
    const reconcile = commands.indexOf("npm run bale:reconcile-releases");
    const dispatch = commands.indexOf("npm run bale:dispatch-group-events");
    assert.ok(build >= 0 && restart > build && reconcile > restart && dispatch > reconcile);
    assert.match(commands, /flock .*bale-notifications\.lock .*npm run bale:dispatch-group-events/);
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
    assert.match(firstCron, /\/bash -lc /);
    assert.match(firstCron, /\/npm\\ run\\ bale:dispatch-group-events/);
    assert.match(firstCron, /\.\\ .*\/\.env/);
    assert.match(firstCron, />\/dev\/null 2>>.*bale-notifications\.log/);
    assert.match(firstCron, new RegExp(bashPath(fixture.lockFile).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(firstCron, /fixture-secret|fixture-chat/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("deployment does not reconcile or install notifications when the build fails", { skip: !existsSync(gitBash) }, async () => {
  const fixture = await deploymentFixture({ failingCommand: "build" });
  try {
    await assert.rejects(runDeployment(fixture));
    const commands = await readFile(fixture.log, "utf8");
    assert.doesNotMatch(commands, /bale:reconcile-releases|bale:dispatch-group-events/);
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
    assert.match(commands, /npm run bale:reconcile-releases/);
    assert.match(commands, /npm run bale:dispatch-group-events/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
