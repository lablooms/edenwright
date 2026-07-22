import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const samplePluginDir = join(appRoot, "..", "..", "sample-plugin");

// M3 done-when (SPEC §12): "Hello, eden" installs from a folder and adds
// its command + panel. Plus the trust dialog and restricted mode (§9.3).
test.describe("M3 — plugin runtime & API", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m3-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M3 Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("install → trust → command + panel → restricted mode", async () => {
    // Install the sample plugin from its folder (done-when).
    const pluginId = await page.evaluate(
      (source) => window.edenwright.plugins.installFromFolder(source),
      samplePluginDir.replace(/\\/g, "/"),
    );
    expect(pluginId).toBe("lablooms.hello-eden");

    // Enable it in settings; the blunt trust dialog must appear (§9.3).
    await page.evaluate(async (id) => {
      const state = await window.edenwright.eden.state();
      const settings = state.current!.settings;
      await window.edenwright.eden.saveSettings({
        ...settings,
        plugins: { ...settings.plugins, enabled: [id] },
      });
    }, pluginId);

    await expect(page.locator(".ew-modal")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".ew-modal__body")).toContainText(
      "same access as Edenwright itself",
    );
    await page
      .locator(".ew-modal__actions button", { hasText: "Enable plugin" })
      .click();

    // Ribbon item appears and opens the plugin's panel.
    const ribbon = page.locator(".ew-sidebar__item[title='Hello, eden']");
    await expect(ribbon).toBeVisible({ timeout: 5000 });
    await ribbon.click();
    await expect(page.locator(".plugin-view-host")).toContainText(
      "Your first plugin panel",
    );

    // The command is in the palette and runs (toast proves it).
    await page.keyboard.press("Control+p");
    await page.locator(".palette__input").fill("hello");
    const command = page.locator(".palette__row", {
      hasText: "Say hello to the eden",
    });
    await expect(command).toBeVisible();
    await command.click();
    await expect(
      page.locator(".ew-toast", { hasText: "Hello from your eden." }),
    ).toBeVisible();

    // Restricted mode disables every community plugin (§9.3).
    await page.evaluate(async () => {
      const state = await window.edenwright.eden.state();
      const settings = state.current!.settings;
      await window.edenwright.eden.saveSettings({
        ...settings,
        plugins: { ...settings.plugins, restrictedMode: true },
      });
    });
    await expect(
      page.locator(".ew-sidebar__item[title='Hello, eden']"),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
