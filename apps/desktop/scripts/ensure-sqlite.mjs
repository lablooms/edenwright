/**
 * better-sqlite3 is a native module: one binary per runtime ABI. Vitest runs
 * it under Node, the app runs it under Electron. This script downloads the
 * matching prebuilt binary (no C++ toolchain needed — see docs/decisions.md)
 * for the requested runtime: `node scripts/ensure-sqlite.mjs node|electron`.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const runtime = process.argv[2];
if (runtime !== "node" && runtime !== "electron") {
  console.error("usage: node scripts/ensure-sqlite.mjs node|electron");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const sqliteDir = dirname(require.resolve("better-sqlite3/package.json"));

const target =
  runtime === "electron"
    ? require("electron/package.json").version
    : process.versions.node;

console.log(`better-sqlite3: fetching ${runtime} ${target} prebuilt binary`);
const prebuildInstallBin = require.resolve("prebuild-install/bin.js");
execFileSync(
  process.execPath,
  [
    prebuildInstallBin,
    "--runtime",
    runtime === "electron" ? "electron" : "node",
    "--target",
    target,
    "--arch",
    process.arch,
  ],
  { cwd: sqliteDir, stdio: "inherit" },
);
