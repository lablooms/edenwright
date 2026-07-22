import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appRoot, "e2e", "artifacts");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-snapm4-"));
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
  await page.locator(".files-panel__icon-button[title='New project…']").click();
  await page.locator(".new-project__engine", { hasText: "Prose" }).click();
  await page.screenshot({ path: join(outDir, "m4-new-project.png") });
  console.log("snap written");
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
