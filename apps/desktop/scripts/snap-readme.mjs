/**
 * Captures the README hero screenshot: launches the built app, creates an
 * eden with a novel project, opens a scene, and screenshots the window to
 * docs/assets/screenshot.png. Not a test — run on demand before releases.
 * Usage: node scripts/snap-readme.mjs
 */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const outDir = join(appRoot, "..", "..", "docs", "assets");

const sandbox = await mkdtemp(join(tmpdir(), "edenwright-readme-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.evaluate(
    (parent) => window.edenwright.eden.create(parent, "Readme Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(async () => {
    await window.edenwright.projects.create({
      name: "Hollow Crown",
      engine: "edenwright.engine.prose",
      preset: "novel",
    });
    await window.edenwright.files.write(
      "Projects/Hollow Crown/manuscript/the-fall.md",
      [
        "---",
        'title: "The Long Way Down"',
        "status: draft",
        "pov: Yuki",
        "---",
        "# The Long Way Down",
        "",
        "Yuki counted the steps as she fell. **Ninety-nine**, *one hundred* — she was sure of it.",
        "",
        "> The city does not forgive heights, @mira had said, and the city kept its ledgers in bone.",
        "",
        "She thought of [[The Gray Fox]] and his `silver_key`, and of the door that was not there yesterday.",
        "",
        "## Ninety-eight",
        "",
        "The wind had opinions about her coat. Somewhere below, the cobbles waited with the patience of arithmetic...",
        "",
      ].join("\n"),
      null,
    );
    await window.edenwright.test.whenRebuilt();
  });
  await page.evaluate(() =>
    window.__ewStores.app
      .getState()
      .openFileAt("Projects/Hollow Crown/manuscript/the-fall.md"),
  );
  await page.waitForTimeout(1200);

  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, "screenshot.png") });
  console.log("screenshot written to", join(outDir, "screenshot.png"));
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
