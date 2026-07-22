import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appRoot, "e2e", "artifacts");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-snapc-"));
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
      name: "Aster Reach Manga",
      engine: "edenwright.engine.comic",
      preset: "manga",
    });
    await window.edenwright.files.write(
      "Projects/Aster Reach Manga/manuscript/chapter one.md",
      [
        "PAGE 1",
        "",
        "PANEL 1",
        "DESCRIPTION: Wide of the attic stairs, dust in the light.",
        "DIALOGUE: YUKI: Ninety-nine steps. I counted.",
        "SFX: creeeeak",
        "ART NOTES: keep her silhouette small",
        "",
        "PANEL 2",
        "DESCRIPTION: Close on her hand on the rail.",
        "DIALOGUE: MIRA (O.S.): And what's on the hundredth?",
        "",
        "PAGE 2",
        "PANEL 1",
        "DESCRIPTION: The door, slightly ajar.",
      ].join("\n"),
      null,
    );
  });
  await page.waitForTimeout(600);
  await page
    .locator(".file-tree__row", { hasText: "Aster Reach Manga" })
    .first()
    .click();
  await page.locator(".file-tree__row", { hasText: "manuscript" }).click();
  await page.locator(".file-tree__row", { hasText: "chapter one.md" }).click();
  await page.locator(".ew-sidebar__item[title='Page flow']").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, "m4-comic.png") });
  console.log("snap written");
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
