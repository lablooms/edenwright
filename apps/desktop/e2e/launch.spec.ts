import { mkdir, mkdtemp, rm } from "node:fs/promises";
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

/**
 * Launch the built app in test mode. `env` carries the two launcher seams:
 * EDENWRIGHT_USERDATA pins app state across a relaunch, and
 * EDENWRIGHT_TEST_PICK_DIR answers native folder pickers (undrivable in e2e).
 */
async function launchApp(
  env: Record<string, string> = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1", ...env },
  });
  return { app, page: await app.firstWindow() };
}

// R2 — the launcher: first-run home, create flow, auto-reopen, recents,
// the title-bar switcher, and the open-folder path.
test.describe("R2 — launcher", () => {
  let sandbox: string;

  test.beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-launch-"));
  });

  test.afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  test("first run shows the launcher with a designed empty state", async () => {
    const { app, page } = await launchApp();
    try {
      await expect(page).toHaveTitle("Edenwright");
      await expect(page.locator(".ew-titlebar__wordmark")).toHaveText(
        "Edenwright",
      );

      // Brand pane + the three ways in; no eden switcher without an eden.
      await expect(page.locator(".launcher__brand")).toBeVisible();
      await expect(page.locator(".launcher__wordmark")).toHaveText(
        "Edenwright",
      );
      await expect(page.locator(".launcher__tagline")).toHaveText(
        "Every story needs a garden.",
      );
      await expect(page.locator(".launcher__empty-recents")).toContainText(
        "No edens yet — every story starts somewhere.",
      );
      await expect(
        page.locator(".launcher__heading", { hasText: "Create a new eden" }),
      ).toBeVisible();
      await expect(
        page.locator(".launcher__heading", { hasText: "Open an eden folder" }),
      ).toBeVisible();
      await expect(page.locator(".eden-switcher")).toHaveCount(0);

      // --ew-void #0B0713, token-driven — never a default gray box (§11).
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(11, 7, 19)",
      );

      const artifactsDir = join(appRoot, "e2e", "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await page.screenshot({ path: join(artifactsDir, "edenwright-m0.png") });
    } finally {
      await app.close();
    }
  });

  test("create flow: name + preset + folder lands in the workspace", async () => {
    const { app, page } = await launchApp({
      EDENWRIGHT_TEST_PICK_DIR: sandbox,
    });
    try {
      await expect(page.locator(".launcher")).toBeVisible();

      await page.getByRole("button", { name: "New eden…" }).click();
      await page.locator(".launcher__input").fill("Aster Reach");
      // A non-default preset proves the picker drives the scaffold.
      await page.locator(".launcher__preset", { hasText: "Manga" }).click();
      await page.getByRole("button", { name: "Choose a folder…" }).click();
      await expect(page.locator(".launcher__location-path")).not.toContainText(
        "No folder chosen yet",
      );

      const createButton = page.getByRole("button", { name: "Create eden" });
      await expect(createButton).toBeEnabled();
      await createButton.click();

      // Straight into the new eden: manga scaffold at the root, world beside
      // it, manifest visible — the launcher is gone.
      await expect(page.locator(".launcher")).toHaveCount(0);
      await expect(
        page.locator(".file-tree__row", { hasText: "pages" }),
      ).toBeVisible();
      await expect(
        page.locator(".file-tree__row", { hasText: "world" }),
      ).toBeVisible();
      await expect(
        page.locator(".file-tree__row", { hasText: "eden.json" }),
      ).toBeVisible();
      await expect(page.locator(".eden-switcher")).toContainText("Aster Reach");
    } finally {
      await app.close();
    }
  });

  test("relaunch auto-reopens the last eden without the launcher", async () => {
    const userData = join(sandbox, "userdata");

    const first = await launchApp({ EDENWRIGHT_USERDATA: userData });
    try {
      await createTestEden(first.page, sandbox, "Returning Eden");
      await expect(
        first.page.locator(".file-tree__row", { hasText: "manuscript" }),
      ).toBeVisible();
    } finally {
      await first.app.close();
    }

    const second = await launchApp({ EDENWRIGHT_USERDATA: userData });
    try {
      // No launcher, no click — the writer lands back in their eden.
      await expect(
        second.page.locator(".file-tree__row", { hasText: "manuscript" }),
      ).toBeVisible();
      await expect(second.page.locator(".launcher")).toHaveCount(0);
      await expect(second.page.locator(".eden-switcher")).toContainText(
        "Returning Eden",
      );
    } finally {
      await second.app.close();
    }
  });

  test("switcher returns to the launcher; recents lists the eden; remove forgets it", async () => {
    const { app, page } = await launchApp();
    try {
      await createTestEden(page, sandbox, "Garden Tale");

      // The title-bar switcher is the canonical eden name + way back.
      const switcher = page.locator(".eden-switcher");
      await expect(switcher).toContainText("Garden Tale");
      await switcher.click();

      await expect(page.locator(".launcher")).toBeVisible();
      const row = page.locator(".launcher__recent-row", {
        hasText: "Garden Tale",
      });
      await expect(row).toBeVisible();
      await expect(row.locator(".launcher__recent-date")).toHaveText("Today");
      await expect(row.locator(".launcher__recent-icon svg")).toHaveCount(1);
      await expect(row.locator(".launcher__recent-path")).toContainText(
        "Garden Tale",
      );

      // Remove forgets the entry — the folder itself survives on disk.
      await row.hover();
      await row.locator(".launcher__recent-remove").click();
      await expect(
        page.locator(".launcher__recent-row", { hasText: "Garden Tale" }),
      ).toHaveCount(0);
      await expect(page.locator(".launcher__empty-recents")).toContainText(
        "No edens yet — every story starts somewhere.",
      );
    } finally {
      await app.close();
    }
  });

  test("'Open an eden folder' opens the picked eden", async () => {
    const edenPath = join(sandbox, "Picked Eden");
    const { app, page } = await launchApp({
      EDENWRIGHT_TEST_PICK_DIR: edenPath,
    });
    try {
      await createTestEden(page, sandbox, "Picked Eden");
      // Back to the launcher, then in through the browse button.
      await page.evaluate(() => window.edenwright.eden.close());
      await expect(page.locator(".launcher")).toBeVisible();

      await page.getByRole("button", { name: "Browse for an eden…" }).click();
      await expect(page.locator(".launcher")).toHaveCount(0);
      await expect(
        page.locator(".file-tree__row", { hasText: "manuscript" }),
      ).toBeVisible();
      await expect(page.locator(".eden-switcher")).toContainText("Picked Eden");
    } finally {
      await app.close();
    }
  });

  test("opening a folder that is not an eden shows a friendly inline error", async () => {
    const plainFolder = join(sandbox, "just-a-folder");
    await mkdir(plainFolder, { recursive: true });
    const { app, page } = await launchApp({
      EDENWRIGHT_TEST_PICK_DIR: plainFolder,
    });
    try {
      await expect(page.locator(".launcher")).toBeVisible();
      await page.getByRole("button", { name: "Browse for an eden…" }).click();
      await expect(page.locator(".launcher__open-error")).toContainText(
        "isn't an eden",
      );
      // Still on the launcher, ready for another try.
      await expect(page.locator(".launcher")).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
