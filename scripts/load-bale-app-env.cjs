const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

const appDir = path.resolve(process.env.BALE_APP_DIR || process.cwd());
loadEnvConfig(appDir, false, { info() {}, error() {} });
