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

// M5 slice 5 (§7.8): goals, progress, streak, per-day chart.
test.describe("M5 — Goals & streaks", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5g-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "M5G Eden");
    await page.evaluate(async () => {
      // Goals live on the eden manifest now (one eden = one story).
      const manifest = await window.edenwright.eden.manifest();
      await window.edenwright.eden.saveManifest({
        ...manifest,
        goals: { targetWords: 90000, dailyWords: 500 },
      });
      // The bridge write doesn't echo back into the store — pull it in.
      await window.__ewStores.app.getState().refreshManifest();
      const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
      await window.edenwright.files.write(
        "manuscript/scene one.md",
        `# Scene one\n\n${words}\n`,
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("goals editors, progress bars, streak calendar, history chart", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/scene one.md"),
    );

    // Editors carry the manifest goals.
    const editors = page.locator(".ew-goals__field input");
    await expect(editors.nth(0)).toHaveValue("90000");
    await expect(editors.nth(1)).toHaveValue("500");

    // Progress bars reflect the index (202 words: heading + body).
    await expect(page.locator(".ew-progress__label").first()).toContainText(
      "202 / 90,000",
    );
    await expect(page.locator(".ew-progress__label").nth(1)).toContainText(
      "today 202 / 500",
    );

    // Streak counts today; the calendar lights today's cell.
    await expect(page.locator(".ew-goals__streak-count")).toHaveText("1");
    await expect(
      page.locator(".ew-goals__day[data-words]").last(),
    ).toBeVisible();

    // History chart has 14 bars, today's tallest.
    await expect(page.locator(".ew-goals__bar")).toHaveCount(14);

    // Write more words; today's count follows the index.
    await page.evaluate(async () => {
      const file = await window.edenwright.files.read(
        "manuscript/scene one.md",
      );
      const more = Array.from({ length: 100 }, (_, i) => `extra${i}`).join(" ");
      await window.edenwright.files.write(
        "manuscript/scene one.md",
        `${file.content}\n${more}\n`,
        file.mtimeMs,
      );
    });
    // Re-open so the store picks up the new mtime and the panel reloads.
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/scene one.md"),
    );
    await expect(page.locator(".ew-progress__label").nth(1)).toContainText(
      "today 302 / 500",
      { timeout: 8000 },
    );
  });
});
