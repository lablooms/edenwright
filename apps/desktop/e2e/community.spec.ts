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

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedsRoot = join(appRoot, "..", "..", "plugins", "seed");
const registryRoot = join(appRoot, "..", "..", "registry");

/**
 * Community installs download release assets from GitHub. The v2 seeds
 * aren't published yet (nothing pushes before the founder reviews), so the
 * spec serves those URLs from the local seed folders — the whole install
 * path (fetch → validate → write → enable → load) runs for real. The
 * registry index itself is stubbed with the v2 fixture (the live registry
 * repo still carries v1 entries until the push).
 */
async function stubReleaseAssets(page: Page) {
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    void (async () => {
      const url = route.request().url();
      const file = url.includes("community-themes.json")
        ? "community-themes.json"
        : url.includes("community-plugins.json")
          ? "community-plugins.json"
          : null;
      if (!file) {
        await route.fulfill({ status: 404, body: "not found" });
        return;
      }
      const body = await readFile(join(registryRoot, file), "utf8");
      await route.fulfill({
        status: 200,
        body,
        contentType: "application/json",
      });
    })();
  });
  await page.route("https://github.com/**/releases/download/**", (route) => {
    void (async () => {
      const url = route.request().url();
      const fileName = url.slice(url.lastIndexOf("/") + 1);
      const pluginMatch = /seed-([a-z-]+)-v/.exec(url);
      if (
        pluginMatch &&
        ["manifest.json", "main.js", "styles.css"].includes(fileName)
      ) {
        try {
          const body = await readFile(
            join(seedsRoot, pluginMatch[1], fileName),
            "utf8",
          );
          await route.fulfill({ status: 200, body });
          return;
        } catch {
          await route.fulfill({ status: 404, body: "no such asset" });
          return;
        }
      }
      await route.fulfill({ status: 404, body: "no such asset" });
    })();
  });
}

test.describe("P4 — Community plugins (v2 seeds)", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-p4-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();
    await stubReleaseAssets(page);

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "P4 Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(async () => {
      await window.edenwright.projects.create({
        name: "Falling Up",
        preset: "feature-film",
        medium: "screenplay",
        scaffold: [
          { path: "screenplay" },
          { path: "codex" },
          { path: "notes" },
        ],
      });
      await window.edenwright.files.write(
        "Projects/Falling Up/screenplay/opening.md",
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

  test("community tab lists the v2 seeds (fixture)", async () => {
    await page.locator('.ew-sidebar button[aria-label="Plugins"]').click();
    await expect(
      page.locator(".ew-community__card", { hasText: "Screenplay Mode" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(".ew-community__card", { hasText: "Medium Exporters" }),
    ).toBeVisible();
    await expect(
      page.locator(".ew-community__card", { hasText: "Story Canvas" }),
    ).toBeVisible();
  });

  test("install screenplay-mode → trust → Courier mode in screenplay projects", async () => {
    const card = page.locator(".ew-community__card", {
      hasText: "Screenplay Mode",
    });
    await card.locator(".ew-community__install").click();
    await expect(page.locator(".ew-modal")).toBeVisible({ timeout: 15000 });
    await page
      .locator(".ew-modal button", { hasText: "Enable plugin" })
      .click();
    await expect(card.locator(".ew-community__installed")).toBeVisible({
      timeout: 15000,
    });

    // Close settings; open the screenplay file; the mode tags its editor.
    await page
      .locator(".settings__footer button", { hasText: "Close" })
      .click();
    await page.evaluate(() =>
      window.__ewStores.app
        .getState()
        .openFileAt("Projects/Falling Up/screenplay/opening.md"),
    );
    await expect(page.locator(".markdown-editor")).toBeVisible();
    const family = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".cm-content"))
        .getPropertyValue("font-family")
        .toLowerCase(),
    );
    expect(family).toContain("courier");
  });

  test("install medium-exporters → its formats join the screenplay dialog", async () => {
    await page.locator('.ew-sidebar button[aria-label="Plugins"]').click();
    const card = page.locator(".ew-community__card", {
      hasText: "Medium Exporters",
    });
    await card.locator(".ew-community__install").click();
    await expect(page.locator(".ew-modal")).toBeVisible({ timeout: 15000 });
    await page
      .locator(".ew-modal button", { hasText: "Enable plugin" })
      .click();
    await expect(card.locator(".ew-community__installed")).toBeVisible({
      timeout: 15000,
    });
    await page
      .locator(".settings__footer button", { hasText: "Close" })
      .click();

    await page.evaluate(() =>
      window.__ewStores.app.getState().setExportOpen(true),
    );
    // Universal formats AND the medium's own, in one dialog.
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
      join(
        sandbox,
        "P4 Eden",
        "Projects",
        "Falling Up",
        "exports",
        "Falling-Up.fountain",
      ),
      "utf8",
    );
    expect(fountain).toContain("INT. ATTIC STUDIO - DAY");
  });
});
