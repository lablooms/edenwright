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
const themesRoot = join(appRoot, "..", "..", "themes");

// Theme release assets come from local theme packages (v2 seeds aren't
// published yet) — the install path itself runs for real.
async function stubThemeAssets(page: Page) {
  await page.route(
    "https://github.com/**/releases/download/theme-*/**",
    (route) => {
      void (async () => {
        const url = route.request().url();
        const fileName = url.slice(url.lastIndexOf("/") + 1);
        const themeMatch = /theme-([a-z-]+)-v/.exec(url);
        try {
          const body = await readFile(
            join(themesRoot, themeMatch?.[1] ?? "", fileName),
            "utf8",
          );
          await route.fulfill({ status: 200, body });
        } catch {
          await route.fulfill({ status: 404, body: "no such asset" });
        }
      })();
    },
  );
}

test.describe("P4 — Themes (v2)", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-p4t-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();
    await stubThemeAssets(page);

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "P4T Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
    await page.evaluate(() =>
      window.__ewStores.app.getState().setSideView("themes"),
    );
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("built-in dark theme is listed and active; it cannot be removed", async () => {
    const card = page.locator(".ew-themes__card", {
      hasText: "Edenwright Dark",
    });
    await expect(card).toBeVisible();
    await expect(card.locator(".ew-themes__active-badge")).toBeVisible();
    await expect(card.locator(".ew-themes__remove")).toHaveCount(0);
    await expect(card).toContainText("always installed");
  });

  test("community section lists the seed themes", async () => {
    await expect(
      page.locator(".ew-community__card", { hasText: "Edenwright Light" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(".ew-community__card", { hasText: "Edenwright Quiet" }),
    ).toBeVisible();
  });

  test("install Edenwright Light → it applies and persists", async () => {
    const voidBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ew-void")
        .trim(),
    );
    expect(voidBefore.toLowerCase()).toBe("#0b0713");

    const card = page.locator(".ew-community__card", {
      hasText: "Edenwright Light",
    });
    await card.locator(".ew-community__install").click();
    await expect(card.locator(".ew-community__installed")).toBeVisible({
      timeout: 20000,
    });

    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--ew-void")
            .trim()
            .toLowerCase(),
        ),
      )
      .toBe("#faf8f1");

    const active = await page.evaluate(async () => {
      const state = await window.edenwright.eden.state();
      return state.current?.settings.theme.active;
    });
    expect(active).toBe("edenwright-light");

    await page.evaluate(() =>
      window.__ewStores.themes.getState().apply("edenwright-dark"),
    );
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--ew-void")
            .trim()
            .toLowerCase(),
        ),
      )
      .toBe("#0b0713");
  });
});
