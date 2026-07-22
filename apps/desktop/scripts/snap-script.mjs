import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appRoot, "e2e", "artifacts");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-snapscr-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  await page.evaluate(
    (p) => window.edenwright.eden.create(p, "Snap Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());
  await page.evaluate(async () => {
    await window.edenwright.projects.create({
      name: "Falling Up",
      engine: "edenwright.engine.script",
      preset: "feature-film",
    });
    await window.edenwright.files.write(
      "Projects/Falling Up/manuscript/scene one.md",
      [
        "INT. ATTIC STUDIO - DAY",
        "",
        "Dust turns in the skylight. YUKI HARROW, thirty and tired, climbs.",
        "",
        "YUKI",
        "(checking the locks)",
        "Ninety-nine steps. I counted every single one.",
        "",
        "MIRA (O.S.)",
        "Then you know what's on the hundredth.",
        "",
        "CUT TO:",
      ].join("\n"),
      null,
    );
  });
  await page.waitForTimeout(600);
  await page
    .locator(".file-tree__row", { hasText: "Falling Up" })
    .first()
    .click();
  await page.locator(".file-tree__row", { hasText: "manuscript" }).click();
  await page.locator(".file-tree__row", { hasText: "scene one.md" }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, "m4-script.png") });
  console.log("snap written");
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
