import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const outDir = join(appRoot, "e2e", "artifacts");
const samplePluginDir = join(appRoot, "..", "..", "sample-plugin");

const sandbox = await mkdtemp(join(tmpdir(), "edenwright-snapset-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();

  await page.evaluate(
    (parent) => window.edenwright.eden.create(parent, "Snap Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());
  await page.evaluate(
    (source) => window.edenwright.plugins.installFromFolder(source),
    samplePluginDir.replace(/\\/g, "/"),
  );
  await page.evaluate(async () => {
    const state = await window.edenwright.eden.state();
    const settings = state.current.settings;
    await window.edenwright.eden.saveSettings({
      ...settings,
      plugins: { ...settings.plugins, enabled: ["lablooms.hello-eden"] },
    });
  });
  await page
    .locator(".ew-modal__actions button", { hasText: "Enable plugin" })
    .click();
  await page.waitForTimeout(600);

  // Trust dialog already handled; open the plugin panel via ribbon.
  await page.locator(".ew-sidebar__item[title='Hello, eden']").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "m3-plugin-panel.png") });

  // Settings → Plugins tab.
  await page.locator(".ew-sidebar__item[title='Plugins']").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "m3-settings-plugins.png") });

  console.log("snapshots written");
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
