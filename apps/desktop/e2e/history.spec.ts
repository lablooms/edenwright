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

// M5 slice 6 (§7.9): per-file versions from snapshots, visual diff, restore.
test.describe("M5 — History", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  const sceneRel = "Projects/Hollow Crown/manuscript/scene one.md";

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5h-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M5H Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    await page.evaluate(async () => {
      await window.edenwright.projects.create({
        name: "Hollow Crown",
        preset: "novel",
        medium: "prose",
        scaffold: [
          { path: "manuscript" },
          { path: "codex" },
          { path: "notes" },
        ],
      });
    });

    // Version 1 on disk → snapshot → version 2 on disk.
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        sceneRel,
        "# The Long Way Down\n\nYuki counted ninety-nine steps.\n",
      ] as const,
    );
    await page.evaluate(() => window.edenwright.test!.snapshotNow());
    await page.evaluate(
      async ([path, text]) => {
        const file = await window.edenwright.files.read(path);
        await window.edenwright.files.write(path, text, file.mtimeMs);
      },
      [
        sceneRel,
        "# The Long Way Down\n\nYuki counted one hundred steps. @mira heard.\n",
      ] as const,
    );

    // Renderer readiness: the bundle sets __ewStores at module load.
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
    await page.evaluate(() =>
      window.__ewStores.app
        .getState()
        .openFileAt("Projects/Hollow Crown/manuscript/scene one.md"),
    );
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("version list, visual diff, one-click restore", async () => {
    // The version appears in History.
    const times = page.locator(".ew-history__time");
    await expect(times).toHaveCount(1, { timeout: 8000 });

    // Expand it: the diff shows the removed old line and the added new one.
    await times.first().click();
    await expect(page.locator(".ew-history__line--remove")).toContainText(
      "ninety-nine steps",
    );
    await expect(page.locator(".ew-history__line--add").first()).toContainText(
      "one hundred steps",
    );

    // Restore with the designed confirm.
    const before = await page.evaluate(
      (path) => window.edenwright.history.versions(path),
      sceneRel,
    );
    await page
      .locator(".ew-history__row button", { hasText: "Restore" })
      .click();
    await page
      .locator(".ew-modal__actions button", { hasText: "Restore" })
      .click();
    await expect(page.locator(".ew-toast")).toContainText("Restored.", {
      timeout: 8000,
    });

    // The old text is back on disk…
    const onDisk = await readFile(
      join(
        sandbox,
        "M5H Eden",
        "Projects",
        "Hollow Crown",
        "manuscript",
        "scene one.md",
      ),
      "utf8",
    );
    expect(onDisk).toContain("ninety-nine steps");

    // …and the pre-restore text is preserved in a NEW snapshot (§11).
    const after = await page.evaluate(
      (path) => window.edenwright.history.versions(path),
      sceneRel,
    );
    expect(after.length).toBeGreaterThan(before.length);
  });
});
