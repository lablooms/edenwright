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

// M8 polish: the Worlds rail is real — no placeholders survive the §11 audit.
test.describe("M8 — Worlds panel", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m8-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M8 Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("worlds list, entity counts, inline create", async () => {
    // Seed a world with one entity, then open the panel.
    await page.evaluate(async () => {
      await window.edenwright.worlds.create("Aster Reach");
      await window.edenwright.files.write(
        "Worlds/Aster Reach/codex/characters/yuki.md",
        "---\ntype: character\nname: Yuki Thorn\n---\nCartographer.\n",
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
    await page.locator('.ew-sidebar button[aria-label="Worlds"]').click();

    const card = page.locator(".ew-worlds__card", { hasText: "Aster Reach" });
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card.locator(".ew-worlds__count")).toContainText("1 entity");
    await expect(card).toContainText("Not linked by any project yet");

    // Inline create adds a second world.
    await page.locator(".ew-worlds__new").click();
    await page.locator(".ew-worlds__input").fill("Hollow Deep");
    await page.locator(".ew-worlds__submit").click();
    await expect(
      page.locator(".ew-worlds__card", { hasText: "Hollow Deep" }),
    ).toBeVisible({ timeout: 8000 });
  });
});
