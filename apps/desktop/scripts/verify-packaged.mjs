/**
 * Smoke-verifies the PACKAGED app (release/win-unpacked by default):
 * launches it, creates an eden, writes a file, and checks the SQLite index
 * counted it — proving the native better-sqlite3 module loads and works in
 * the packaged build. Usage: node scripts/verify-packaged.mjs [exe-path]
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const exePath =
  process.argv[2] ??
  join(here, "..", "release", "win-unpacked", "Edenwright.exe");

const sandbox = await mkdtemp(join(tmpdir(), "edenwright-packaged-"));
let app;
try {
  app = await electron.launch({
    executablePath: exePath,
    args: [...(process.env.CI ? ["--no-sandbox"] : [])],
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  await page.evaluate(
    (parent) => window.edenwright.eden.create(parent, "Packaged Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());
  await page.evaluate(
    ([path, text]) => window.edenwright.files.write(path, text, null),
    ["Projects/hello.md", "# It works\n\nA packaged app just wrote this.\n"],
  );
  const stats = await page.evaluate(() => window.edenwright.test.indexStats());
  if (stats.files !== 1) {
    throw new Error(`index counted ${stats.files} files, expected 1`);
  }
  // Bundled seeds must ride along (extraResources → resources/bundle).
  const bundled = await page.evaluate(() =>
    window.edenwright.app.readBundled(
      "plugins/seed/screenplay-mode/manifest.json",
    ),
  );
  if (!bundled.includes("lablooms.screenplay-mode")) {
    throw new Error("bundled seed manifest missing from the packaged app");
  }
  console.log(
    "Packaged app verified: launches, writes, indexes (native sqlite OK), bundled seeds present.",
  );
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
