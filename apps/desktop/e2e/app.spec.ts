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

import { createTestEden } from "./helpers";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// W3 (founder): an actual app has About, credits, and a manual update check.
test.describe("W3 — App-iness: Help, About, updates", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-w3-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();
    await createTestEden(page, sandbox, "W3 Eden");
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("Help menu lists About, updates, guide, issues, DevTools", async () => {
    await page.locator('button[title="Help"]').click();
    const menu = page.locator(".help-menu__dropdown");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("About Edenwright");
    await expect(menu).toContainText("Check for Updates");
    await expect(menu).toContainText("User guide");
    await expect(menu).toContainText("Report an issue");
    await expect(menu).toContainText("Toggle DevTools");
    await page.keyboard.press("Escape");
  });

  test("About dialog: version, warm line, Lablooms credit, links", async () => {
    await page.locator('button[title="Help"]').click();
    await page
      .locator(".help-menu__dropdown button", { hasText: "About Edenwright" })
      .click();
    const about = page.locator(".about");
    await expect(about).toBeVisible();
    await expect(about.locator(".about__version")).toContainText("0.1.0-beta");
    await expect(about).toContainText("studio for every kind of story");
    await expect(about.locator(".about__pink")).toContainText(
      "Lablooms Studio",
    );
    await expect(about.locator(".about__link").first()).toContainText(
      "Source & issues",
    );
    await about.locator("button", { hasText: "Close" }).click();
    await expect(about).toHaveCount(0);
  });

  test("beta badge opens About too", async () => {
    await page.locator(".ew-titlebar__badge--button").click();
    await expect(page.locator(".about")).toBeVisible();
    await page.locator(".about button", { hasText: "Close" }).click();
  });

  test("manual update check reports a result (any state, never silent)", async () => {
    await page.locator('button[title="Help"]').click();
    await page
      .locator(".help-menu__dropdown button", { hasText: "Check for Updates" })
      .click();
    // One of: newest bloom / a newer release / the garden gate (offline).
    await expect(page.locator(".ew-modal")).toBeVisible({ timeout: 15000 });
    await page.locator(".ew-modal button").first().click();
  });
});
