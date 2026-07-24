import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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

// M1 done-when (SPEC §12): files edited externally appear live; deleting
// .eden/index.db is a non-event. Plus conflict copies and snapshots.
test.describe("M1 — edens & files", () => {
  let sandbox: string;
  let edenPath: string;
  let app: ElectronApplication;
  let page: Page;

  // One eden = one story: the scaffold lives at the eden root.
  const sceneRel = "manuscript/scene one.md";

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
    await createTestEden(page, sandbox, "Test Eden");

    // The tree shows the eden structure: scaffold at root, one world, the
    // manifest visible — machine dirs (.eden, exports) stay hidden.
    await expect(
      page.locator(".file-tree__row", { hasText: "manuscript" }),
    ).toBeVisible();
    await expect(
      page.locator(".file-tree__row", { hasText: "world" }),
    ).toBeVisible();
    await expect(
      page.locator(".file-tree__row", { hasText: "eden.json" }),
    ).toBeVisible();
    await expect(
      page.locator(".file-tree__row", { hasText: "exports" }),
    ).toHaveCount(0);

    // Write a scene; it appears in the tree and opens in the viewer.
    // (Only world/ starts expanded — open manuscript first. Tree refreshes
    // are latest-wins sequenced, so a plain DOM click is safe here.)
    await page.locator(".file-tree__row", { hasText: "manuscript" }).click();
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
      join(edenPath, "manuscript", "scene one.md"),
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
      join(edenPath, "manuscript", "scene one.md"),
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
      join(edenPath, "manuscript", "scene one.md"),
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

  test("legacy eden migrates on open: in-place collapse, world merged, backup kept", async () => {
    // A pre-collapse eden on disk: Projects/ + Worlds/, no eden.json
    // (mirrors packages/core/src/migration.test.ts fixtures).
    const legacyPath = join(sandbox, "Legacy Tale");
    const projectJson = `${JSON.stringify(
      {
        id: "prj_hollow",
        name: "Hollow Crown",
        preset: "novel",
        medium: "prose",
        createdAt: "2026-01-01T00:00:00.000Z",
        linkedWorlds: ["wld_aster"],
        goals: { targetWords: 50000 },
        order: [],
      },
      null,
      2,
    )}\n`;
    const worldJson = `${JSON.stringify(
      {
        id: "wld_aster",
        name: "Aster Reach",
        description: "The city above the fog.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      null,
      2,
    )}\n`;
    await mkdir(join(legacyPath, ".eden"), { recursive: true });
    await writeFile(join(legacyPath, ".eden", "settings.json"), "{}\n");
    await mkdir(join(legacyPath, "Projects", "Hollow Crown", "manuscript"), {
      recursive: true,
    });
    await writeFile(
      join(legacyPath, "Projects", "Hollow Crown", "project.json"),
      projectJson,
    );
    await writeFile(
      join(
        legacyPath,
        "Projects",
        "Hollow Crown",
        "manuscript",
        "chapter one.md",
      ),
      "# Chapter One\n\nYuki ran.\n",
    );
    await mkdir(join(legacyPath, "Worlds", "Aster Reach", "codex"), {
      recursive: true,
    });
    await writeFile(
      join(legacyPath, "Worlds", "Aster Reach", "world.json"),
      worldJson,
    );
    await writeFile(
      join(legacyPath, "Worlds", "Aster Reach", "codex", "yuki.md"),
      "---\nname: Yuki\n---\n",
    );

    // Open it — the collapse happens inside open().
    await page.evaluate(
      (path) => window.edenwright.eden.open(path).then(() => undefined),
      legacyPath.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());

    // eden.json at the root: the project's fields, minus linkedWorlds,
    // plus the linked world's description.
    const manifest = await page.evaluate(() =>
      window.edenwright.eden.manifest(),
    );
    expect(manifest).toMatchObject({
      id: "prj_hollow",
      name: "Hollow Crown",
      preset: "novel",
      medium: "prose",
      description: "The city above the fog.",
      goals: { targetWords: 50000 },
    });
    const rawManifest = JSON.parse(
      await readFile(join(legacyPath, "eden.json"), "utf8"),
    ) as Record<string, unknown>;
    expect("linkedWorlds" in rawManifest).toBe(false);

    // Story moved to the root; the world merged into world/codex.
    const chapter = await readFile(
      join(legacyPath, "manuscript", "chapter one.md"),
      "utf8",
    );
    expect(chapter).toContain("Yuki ran.");
    const entity = await readFile(
      join(legacyPath, "world", "codex", "yuki.md"),
      "utf8",
    );
    expect(entity).toContain("name: Yuki");

    // Legacy top-level dirs are gone; the backup holds every legacy manifest.
    await expect(access(join(legacyPath, "Projects"))).rejects.toThrow();
    await expect(access(join(legacyPath, "Worlds"))).rejects.toThrow();
    const backupProject = await readFile(
      join(
        legacyPath,
        ".eden",
        "migration-backup",
        "Projects",
        "Hollow Crown",
        "project.json",
      ),
      "utf8",
    );
    expect(backupProject).toBe(projectJson);
    const backupWorld = await readFile(
      join(
        legacyPath,
        ".eden",
        "migration-backup",
        "Worlds",
        "Aster Reach",
        "world.json",
      ),
      "utf8",
    );
    expect(backupWorld).toBe(worldJson);
  });

  test("first run: a preset-flavored welcome.md greets the writer, unindexed", async () => {
    // A manga eden speaks in pages, not scenes.
    await createTestEden(page, sandbox, "Manga Eden", {
      preset: "manga",
      medium: "comic",
      scaffold: [{ path: "pages" }, { path: "notes" }],
    });

    // It sits at the eden root, visible in the tree like any other file.
    await expect(
      page.locator(".file-tree__row", { hasText: "welcome.md" }),
    ).toBeVisible();

    const note = await readFile(
      join(sandbox, "Manga Eden", "welcome.md"),
      "utf8",
    );
    expect(note).toContain("# Welcome to Manga Eden");
    expect(note).toContain("pages");
    expect(note).toContain("**World** tab");
    expect(note).toContain("Writing guide");

    // Orientation, not writing: its words never reach the index or goals.
    const stats = await page.evaluate(() =>
      window.edenwright.test!.indexStats(),
    );
    expect(stats.files).toBe(0);
  });
});
