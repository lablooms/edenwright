import { mkdtemp, readFile, rm } from "node:fs/promises";
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

import { createTestEden } from "./helpers";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const samplePluginDir = join(appRoot, "..", "..", "sample-plugin");

const CORE_PLUGIN_NAMES = [
  "Screenplay Mode",
  "Comic Rail",
  "Story Canvas",
  "Medium Exporters",
  "Sprints",
  "Stats Deluxe",
  "Namesmith",
  "Structure Wizards",
];

/** Computed font-family of the open editor, lowercased. */
function editorFontFamily(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.querySelector(".cm-content"))
      .getPropertyValue("font-family")
      .toLowerCase(),
  );
}

// R5 (SPEC §9): Obsidian-style plugins — the eight first-party seeds are
// core plugins (bundled, on by default, no install, no trust prompt) and
// folder-installed plugins keep the trust dialog + restricted mode.
test.describe("R5 — core & installed plugins", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-r5-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    // One eden = one story: the eden IS the screenplay "Falling Up".
    await createTestEden(page, sandbox, "Falling Up", {
      preset: "feature-film",
      medium: "screenplay",
      scaffold: [{ path: "screenplay" }, { path: "notes" }],
    });
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "screenplay/opening.md",
        "INT. ATTIC STUDIO - DAY\n\nDust turns in the light.\n",
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("core plugins load without a trust prompt; the core tab lists all eight", async () => {
    // Core plugins are first-party — enabling them never raises the modal.
    await expect(page.locator(".ew-modal")).toHaveCount(0);

    await page.locator('.ew-sidebar button[aria-label="Plugins"]').click();
    // The core tab is the default.
    await expect(page.locator(".settings__subtab[data-active]")).toHaveText(
      "Core plugins",
    );
    for (const name of CORE_PLUGIN_NAMES) {
      await expect(
        page.locator(".settings__plugin", { hasText: name }),
      ).toBeVisible({ timeout: 10000 });
    }
    // Plain-language description straight from the manifest.
    await expect(
      page.locator(".settings__plugin", { hasText: "Screenplay Mode" }),
    ).toContainText("Courier-page screenplay writing");
    // Core plugins can't be uninstalled — the rows carry only a toggle.
    await expect(
      page
        .locator(".settings__plugin", { hasText: "Screenplay Mode" })
        .locator("button"),
    ).toHaveCount(0);
    await page
      .locator(".settings__footer button", { hasText: "Close" })
      .click();
  });

  test("screenplay mode is on by default; the core toggle applies live", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("screenplay/opening.md"),
    );
    await expect(page.locator(".markdown-editor")).toBeVisible();
    // On by default: Courier mode owns the editor, the toolbar steps aside.
    await expect.poll(() => editorFontFamily(page)).toContain("courier");
    await expect(page.locator(".editor-toolbar")).not.toBeVisible();

    // Toggle off in the core tab — the mode lets go immediately.
    await page.locator('.ew-sidebar button[aria-label="Plugins"]').click();
    const row = page.locator(".settings__plugin", {
      hasText: "Screenplay Mode",
    });
    await row.locator('input[type="checkbox"]').click();
    await expect.poll(() => editorFontFamily(page)).not.toContain("courier");
    await expect(page.locator(".editor-toolbar")).toBeVisible();

    // And back on.
    await row.locator('input[type="checkbox"]').click();
    await expect.poll(() => editorFontFamily(page)).toContain("courier");
    await expect(page.locator(".editor-toolbar")).not.toBeVisible();
    await page
      .locator(".settings__footer button", { hasText: "Close" })
      .click();
  });

  test("medium exporters join the export dialog (core, on by default)", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().setExportOpen(true),
    );
    // Universal formats AND the medium's own, in one dialog — no install.
    await expect(
      page.locator(".export-modal__format", { hasText: "Fountain" }),
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator(".export-modal__format", { hasText: "EPUB" }),
    ).toBeVisible();

    await page
      .locator(".export-modal__format", { hasText: "Fountain" })
      .click();
    await page
      .locator(".export-modal__actions button", { hasText: "Export" })
      .click();
    await expect(page.locator(".export-modal__files")).toContainText(
      "Falling-Up.fountain",
      { timeout: 15000 },
    );
    const fountain = await readFile(
      join(sandbox, "Falling Up", "exports", "Falling-Up.fountain"),
      "utf8",
    );
    expect(fountain).toContain("INT. ATTIC STUDIO - DAY");
    await page
      .locator(".export-modal__actions button", { hasText: "Done" })
      .click();
  });

  test("folder plugin: install → trust → command + panel → restricted mode spares core", async () => {
    // Install the sample plugin from its folder (M3 done-when).
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

    // Restricted mode silences the folder plugin — but core plugins are
    // first-party and stay on (R5): Courier mode still owns the editor.
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
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("screenplay/opening.md"),
    );
    await expect.poll(() => editorFontFamily(page)).toContain("courier");
  });
});
