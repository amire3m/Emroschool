import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("the Bale CLI loader parses dotenv values without evaluating shell syntax", async () => {
  const appDir = await mkdtemp(path.join(tmpdir(), "bale-env-"));
  const marker = path.join(appDir, "executed");
  try {
    await writeFile(path.join(appDir, ".env"), [
      "BALE_BOT_TOKEN='literal token $(touch executed)'",
      'BALE_COORDINATION_CHAT_ID="chat #42"',
      "MULTILINE='first\\nsecond'",
    ].join("\n"));

    const loader = path.join(process.cwd(), "scripts", "load-bale-app-env.cjs");
    const { stdout } = await execFileAsync(process.execPath, [
      "--require",
      loader,
      "-e",
      "console.log(JSON.stringify({ token: process.env.BALE_BOT_TOKEN, chat: process.env.BALE_COORDINATION_CHAT_ID, multiline: process.env.MULTILINE, deployOnly: process.env.DEPLOY_ONLY_SECRET }))",
    ], { cwd: appDir, env: { NODE_ENV: "production", PATH: process.env.PATH } });

    const loaded = JSON.parse(stdout);
    assert.deepEqual(loaded, {
      token: "literal token $(touch executed)",
      chat: "chat #42",
      multiline: "first\\nsecond",
    });
    assert.equal("deployOnly" in loaded, false);
    await assert.rejects(readFile(marker), { code: "ENOENT" });
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});
