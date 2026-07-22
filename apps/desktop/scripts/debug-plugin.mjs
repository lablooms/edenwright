import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const samplePluginDir = join(appRoot, "..", "..", "sample-plugin");

const sandbox = await mkdtemp(join(tmpdir(), "edenwright-debug-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  page.on("console", (msg) =>
    console.log("[renderer]", msg.type(), msg.text()),
  );
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.evaluate(
    (parent) => window.edenwright.eden.create(parent, "Debug Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());

  const pluginId = await page.evaluate(
    (source) => window.edenwright.plugins.installFromFolder(source),
    samplePluginDir.replace(/\\/g, "/"),
  );
  console.log("installed:", pluginId);

  await page.evaluate(async (id) => {
    const state = await window.edenwright.eden.state();
    const settings = state.current.settings;
    await window.edenwright.eden.saveSettings({
      ...settings,
      plugins: { ...settings.plugins, enabled: [id] },
    });
  }, pluginId);
  console.log("settings saved, waiting for modal…");
  await page.waitForTimeout(3000);

  console.log("modal visible:", await page.locator(".ew-modal").isVisible());
  console.log("toasts:", await page.locator(".ew-toast").allTextContents());
  if (await page.locator(".ew-modal").isVisible()) {
    await page
      .locator(".ew-modal__actions button", { hasText: "Enable plugin" })
      .click();
    await page.waitForTimeout(2000);
    console.log(
      "after enable click — toasts:",
      await page.locator(".ew-toast").allTextContents(),
    );
    console.log(
      "ribbon visible:",
      await page.locator(".ew-sidebar__item[title='Hello, eden']").isVisible(),
    );
  }
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
