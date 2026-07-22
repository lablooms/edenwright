import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-dbgc-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  page.on("console", (m) => console.log("[r]", m.text().slice(0, 150)));
  await page.evaluate(
    (p) => window.edenwright.eden.create(p, "Dbg Eden"),
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
      "PAGE 1\n\nPANEL 1\nDESCRIPTION: Wide.\n",
      null,
    );
    await window.edenwright.test.whenRebuilt();
  });
  await page.waitForTimeout(800);

  const state1 = await page.evaluate(() => {
    const { app, plugins } = window.__ewStores;
    return {
      engines: plugins.getState().engines.map((e) => e.id),
      projects: app.getState().projects.map((p) => `${p.name}:${p.engine}`),
    };
  });
  console.log("before open:", JSON.stringify(state1));

  await page
    .locator(".file-tree__row", { hasText: "Aster Reach Manga" })
    .first()
    .click();
  await page.locator(".file-tree__row", { hasText: "manuscript" }).click();
  await page.locator(".file-tree__row", { hasText: "chapter one.md" }).click();
  await page.waitForTimeout(800);

  const state2 = await page.evaluate(() => {
    const { plugins } = window.__ewStores;
    return {
      engines: plugins
        .getState()
        .engines.map((e) => [e.id, Boolean(e.editorExtension)]),
      comicPageLines: document.querySelectorAll(".cm-ew-comic-page").length,
      liveDocLen: document.querySelectorAll(".ew-flow-rail__page").length,
    };
  });
  console.log("after open:", JSON.stringify(state2));
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
