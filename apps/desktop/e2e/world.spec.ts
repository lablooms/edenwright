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

import { createTestEden } from "./helpers";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// R3 (§7.4): the World tab — the eden's worldbuilding hub.
test.describe("R3 — World tab", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-r3-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "R3 Eden");
    await page.evaluate(async () => {
      // One eden = one world: entities live in world/codex.
      await window.edenwright.files.write(
        "world/codex/yuki.md",
        '---\nid: ent_yuki\ntype: character\nname: Yuki Harrow\naliases: ["The Gray Fox"]\nfields:\n  age: 27\n---\nBackstory.\n',
        null,
      );
      await window.edenwright.files.write(
        "manuscript/scene one.md",
        "# The Long Way Down\n\n@yuki counted the steps. @yuki counted twice.\n",
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("World rail button opens the world panel", async () => {
    await page.locator(".ew-sidebar__item[title='World']").click();
    await expect(page.locator(".world-panel")).toBeVisible();
    await expect(
      page.locator(".world-panel__section-title", { hasText: "Entities" }),
    ).toBeVisible();
    await expect(
      page.locator(".world-panel__section-title", {
        hasText: "World notes & maps",
      }),
    ).toBeVisible();
    await expect(
      page.locator(".world-panel__section-title", { hasText: "Timeline" }),
    ).toBeVisible();
  });

  test("entity list groups by type with collapse and filter", async () => {
    const group = page.locator(".world-panel__group-title", {
      hasText: "Character",
    });
    await expect(group).toContainText("1");
    await expect(page.locator(".world-panel__entity-name")).toContainText(
      "Yuki Harrow",
    );
    await expect(page.locator(".world-panel__entity-alias")).toContainText(
      "The Gray Fox",
    );

    // Collapse hides the rows; expand brings them back.
    await group.click();
    await expect(page.locator(".world-panel__entity")).toHaveCount(0);
    await group.click();
    await expect(page.locator(".world-panel__entity")).toHaveCount(1);

    // Filter narrows by name and alias.
    await page.locator(".world-panel__filter").fill("gray fox");
    await expect(page.locator(".world-panel__entity-name")).toHaveCount(1);
    await expect(page.locator(".world-panel__entity-name")).toContainText(
      "Yuki Harrow",
    );
    await page.locator(".world-panel__filter").fill("nobody");
    await expect(page.locator(".world-panel__entity-name")).toHaveCount(0);
    await expect(page.locator(".world-panel")).toContainText(
      "Nothing named “nobody” grows here.",
    );
    await page.locator(".world-panel__filter").fill("");
  });

  test("create buttons make world/codex/<name>.md and open the sheet", async () => {
    await page
      .locator(".world-panel__create-type", { hasText: "Place" })
      .click();
    await page.locator(".world-panel__create-input").fill("Aster Reach");
    await page.keyboard.press("Enter");
    await expect(page.locator(".codex-sheet__name")).toHaveValue(
      "Aster Reach",
      { timeout: 8000 },
    );

    const onDisk = await readFile(
      join(sandbox, "R3 Eden", "world", "codex", "Aster Reach.md"),
      "utf8",
    );
    expect(onDisk).toContain("type: place");

    // The new entity joins the list under its own type group.
    await expect(
      page.locator(".world-panel__group-title", { hasText: "Place" }),
    ).toBeVisible();
    await expect(
      page.locator(".world-panel__entity-name", { hasText: "Aster Reach" }),
    ).toBeVisible();
  });

  test("appearances show on a sheet after mentioning in a manuscript", async () => {
    await page
      .locator(".world-panel__entity", { hasText: "Yuki Harrow" })
      .click();
    await expect(page.locator(".codex-sheet")).toBeVisible();
    await expect(page.locator(".codex-sheet__appearance")).toHaveCount(1);
    await expect(page.locator(".codex-sheet__appearance-path")).toContainText(
      "scene one.md",
    );
    await expect(page.locator(".codex-sheet__appearance-count")).toContainText(
      "×2",
    );

    // Click through to the scene.
    await page.locator(".codex-sheet__appearance").click();
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      "The Long Way Down",
    );
  });

  test("world notes & maps shortcut rows", async () => {
    // Empty folders offer a create-first action.
    const notesRow = page.locator(".world-panel__shortcut", {
      hasText: "World notes",
    });
    await expect(notesRow).toContainText("make the first one");
    await expect(
      page.locator(".world-panel__shortcut", { hasText: "Maps" }),
    ).toContainText("make the first one");

    await notesRow.click();
    await page.locator(".world-panel__create-input").fill("Travel log");
    await page.keyboard.press("Enter");
    await expect(page.locator(".markdown-editor")).toBeVisible({
      timeout: 8000,
    });
    const onDisk = await readFile(
      join(sandbox, "R3 Eden", "world", "notes", "Travel log.md"),
      "utf8",
    );
    expect(onDisk).toContain("# Travel log");

    // With a note inside, the row reveals the folder in the Files panel.
    await expect(notesRow).toContainText("1");
    await notesRow.click();
    await expect(page.locator(".files-panel")).toBeVisible();
    await expect(
      page.locator(".file-tree__name", { hasText: "Travel log.md" }),
    ).toBeVisible();

    // Back to the World panel for the next test.
    await page.locator(".ew-sidebar__item[title='World']").click();
    await expect(page.locator(".world-panel")).toBeVisible();
  });

  test("Story timeline switches the main view", async () => {
    await expect(page.locator(".world-panel__hint")).toContainText(
      "See your events in story-time order.",
    );
    await page
      .locator(".world-panel__shortcut", { hasText: "Story timeline" })
      .click();
    // No dated scenes here, so the timeline shows its designed empty state.
    await expect(page.locator("main")).toContainText(
      "Nothing on the timeline yet.",
    );
    await page.evaluate(() =>
      window.__ewStores.app.getState().setMainView("editor"),
    );
  });
});

test.describe("R3 — World tab (empty world)", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-r3e-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();
    await createTestEden(page, sandbox, "R3 Empty Eden");
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("empty state explains the five types", async () => {
    await page.locator(".ew-sidebar__item[title='World']").click();
    await expect(page.locator(".world-panel__empty-title")).toContainText(
      "Your world starts here.",
    );
    const hints = page.locator(".world-panel__hints");
    await expect(hints).toContainText("Characters — the people in your story");
    await expect(hints).toContainText("Places — where things happen");
    await expect(hints).toContainText("Items — things that matter");
    await expect(hints).toContainText("Factions — groups and sides");
    await expect(hints).toContainText("Lore — the rules and history");
  });
});
