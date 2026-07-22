import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

// M1 done-when (SPEC §12): files edited externally appear live; deleting
// .eden/index.db is a non-event. Plus conflict copies and snapshots.
test.describe("M1 — edens & files", () => {
  let sandbox: string;
  let edenPath: string;
  let app: ElectronApplication;
  let page: Page;

  const sceneRel = "Projects/scene one.md";

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-"));
    edenPath = join(sandbox, "Test Eden");
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("eden lifecycle: create → write → external edits live → index rebuild → conflicts → snapshot", async () => {
    // Create an eden through the bridge (no native dialogs in e2e).
    await page.evaluate(
      (parent) =>
        window.edenwright.eden
          .create(parent, "Test Eden")
          .then(() => undefined),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());

    // The tree shows the eden structure.
    await expect(
      page.locator(".file-tree__row", { hasText: "Projects" }),
    ).toBeVisible();
    await expect(
      page.locator(".file-tree__row", { hasText: "Worlds" }),
    ).toBeVisible();

    // Write a scene; it appears in the tree and opens in the viewer.
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [sceneRel, "# The Long Way Down\n\nYuki counted the steps.\n"] as const,
    );
    await expect(
      page.locator(".file-tree__row", { hasText: "scene one.md" }),
    ).toBeVisible();
    await page.locator(".file-tree__row", { hasText: "scene one.md" }).click();
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      /Yuki counted the steps/,
    );

    // Index has the file.
    let stats = await page.evaluate(() => window.edenwright.test!.indexStats());
    expect(stats.files).toBe(1);

    // External edit → the viewer follows live (done-when #1).
    await page.waitForTimeout(50);
    await writeFile(
      join(edenPath, "Projects", "scene one.md"),
      "# Edited outside\n\nWords planted by another program.\n",
    );
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      /Words planted by another program/,
      { timeout: 8000 },
    );

    // Delete .eden/index.db → reopen → rebuilt from files (done-when #2).
    await page.evaluate(() => window.edenwright.eden.close());
    for (const suffix of ["", "-wal", "-shm"]) {
      await rm(join(edenPath, ".eden", `index.db${suffix}`), { force: true });
    }
    await page.evaluate(
      (path) => window.edenwright.eden.open(path).then(() => undefined),
      edenPath.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    stats = await page.evaluate(() => window.edenwright.test!.indexStats());
    expect(stats.files).toBe(1);

    // Conflict safety: stale base write becomes a conflicted copy (§5.4).
    const { mtimeMs: stale } = await page.evaluate(
      (path) => window.edenwright.files.read(path),
      sceneRel,
    );
    await page.waitForTimeout(50);
    await writeFile(
      join(edenPath, "Projects", "scene one.md"),
      "# Disk moved on\n\nNewer words from outside.\n",
    );
    const result = await page.evaluate(
      ([path, base]) =>
        window.edenwright.files.write(
          path,
          "# App draft\n\nWords from the app.\n",
          base,
        ),
      [sceneRel, stale] as const,
    );
    expect(result.conflictedPath).toBeTruthy();
    const copyText = await readFile(
      join(edenPath, result.conflictedPath!),
      "utf8",
    );
    expect(copyText).toContain("Words from the app");
    const diskText = await readFile(
      join(edenPath, "Projects", "scene one.md"),
      "utf8",
    );
    expect(diskText).toContain("Newer words from outside");

    // Snapshots: a zip lands in .eden/snapshots.
    const snapshotName = await page.evaluate(() =>
      window.edenwright.test!.snapshotNow(),
    );
    expect(snapshotName).toMatch(/\.zip$/);
    await access(join(edenPath, ".eden", "snapshots", snapshotName!));
  });
});
