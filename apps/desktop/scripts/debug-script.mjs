import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-dbgs-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  page.on("console", (m) => console.log("[r]", m.text().slice(0, 120)));
  await page.evaluate(
    (p) => window.edenwright.eden.create(p, "Dbg Eden"),
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
      "INT. ATTIC - DAY\n\nDust.\n",
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
  await page.waitForTimeout(500);

  const yukiLine = page.locator(".cm-line", { hasText: "YUKI" });
  await page.locator(".markdown-editor .cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("YUKI");
  await page.waitForTimeout(300);
  console.log("after typing:", await yukiLine.getAttribute("class"));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  console.log("after Tab 1:", await yukiLine.getAttribute("class"));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  console.log("after Tab 2:", await yukiLine.getAttribute("class"));
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
