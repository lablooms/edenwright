import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

// M6 (SPEC §10/§12): the export pipeline — registry, dialog, exports/ on disk.
test.describe("M6 — Exports (prose pipeline)", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m6-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    // One eden = one story: the eden IS "Hollow Crown" — its name drives
    // the dialog title and the exported filenames.
    await createTestEden(page, sandbox, "Hollow Crown");
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "manuscript/fall.md",
        '---\ntitle: "The Long Way Down"\n---\nYuki counted **ninety-nine** steps as she fell.\n',
        null,
      );
      await window.edenwright.files.write(
        "manuscript/door.md",
        '---\ntitle: "The Door"\n---\nThe door was not there yesterday.\n',
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/fall.md"),
    );
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("export dialog: format → run → files in exports/", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().setExportOpen(true),
    );
    const dialog = page.locator('[role="dialog"][aria-label="Export eden"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator(".export-modal")).toContainText(
      "Export Hollow Crown",
    );

    // Clean Markdown first.
    await page
      .locator(".export-modal__format", { hasText: "Clean Markdown" })
      .click();
    await page
      .locator(".export-modal__actions button", { hasText: "Export" })
      .click();
    await expect(page.locator(".export-modal__files")).toContainText(
      "Hollow-Crown.md",
      { timeout: 15000 },
    );

    const markdown = await readFile(
      join(sandbox, "Hollow Crown", "exports", "Hollow-Crown.md"),
      "utf8",
    );
    expect(markdown).toContain("# Hollow Crown");
    expect(markdown).toContain("## The Long Way Down");
    expect(markdown).toContain("**ninety-nine**");

    // docx and PDF land too.
    await page
      .locator(".export-modal__actions button", { hasText: "Done" })
      .click();
    await page.evaluate(() =>
      window.__ewStores.app.getState().setExportOpen(true),
    );
    await page
      .locator(".export-modal__format", { hasText: "Word (.docx)" })
      .click();
    await page
      .locator(".export-modal__actions button", { hasText: "Export" })
      .click();
    await expect(page.locator(".export-modal__files")).toContainText(
      "Hollow-Crown.docx",
      { timeout: 15000 },
    );

    await page
      .locator(".export-modal__actions button", { hasText: "Done" })
      .click();
    await page.evaluate(() =>
      window.__ewStores.app.getState().setExportOpen(true),
    );
    await page
      .locator(".export-modal__format", { hasText: "PDF (.pdf)" })
      .click();
    await page
      .locator(".export-modal__actions button", { hasText: "Export" })
      .click();
    await expect(page.locator(".export-modal__files")).toContainText(
      "Hollow-Crown.pdf",
      { timeout: 20000 },
    );

    const exportsDir = join(sandbox, "Hollow Crown", "exports");
    for (const file of [
      "Hollow-Crown.md",
      "Hollow-Crown.docx",
      "Hollow-Crown.pdf",
    ]) {
      const info = await stat(join(exportsDir, file));
      expect(info.size).toBeGreaterThan(100);
    }
  });
});
