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

// M5 slice 1 (§7.4): the designed entity sheet. Panel-level coverage
// (groups, filter, create buttons, appearances) lives in world.spec.ts.
test.describe("M5 — Codex sheets", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5c-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "M5C Eden");
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

    await page.locator(".ew-sidebar__item[title='World']").click();
    await expect(page.locator(".world-panel")).toBeVisible();
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("designed sheet: fields, aliases — not raw frontmatter", async () => {
    await page.locator(".world-panel__entity-name").click();

    // The sheet, not the raw file.
    await expect(page.locator(".codex-sheet")).toBeVisible();
    await expect(page.locator(".codex-sheet__type")).toContainText("Character");
    await expect(page.locator(".codex-sheet__name")).toHaveValue("Yuki Harrow");
    await expect(page.locator(".codex-sheet__alias")).toContainText(
      "The Gray Fox",
    );
    await expect(
      page.locator(".codex-sheet__field", { hasText: "Age" }).locator("input"),
    ).toHaveValue("27");
  });

  test("editing a field saves typed frontmatter", async () => {
    await page.locator(".world-panel__entity-name").click();
    const ageInput = page
      .locator(".codex-sheet__field", { hasText: "Age" })
      .locator("input");
    await ageInput.fill("28");
    await page
      .locator(".codex-sheet__actions button", { hasText: "Save" })
      .click();
    await expect(
      page.locator(".codex-sheet__actions button", { hasText: "Save" }),
    ).toBeDisabled();

    const onDisk = await readFile(
      join(sandbox, "M5C Eden", "world", "codex", "yuki.md"),
      "utf8",
    );
    expect(onDisk).toContain("age: 28");
  });

  test("@-completion stays open from the first letter (W1)", async () => {
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "manuscript/completion probe.md",
        "The fox ran. ",
        null,
      );
      await window.__ewStores.app
        .getState()
        .openFileAt("manuscript/completion probe.md");
    });
    await expect(page.locator(".markdown-editor")).toBeVisible();
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("@");
    await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible({
      timeout: 5000,
    });
    // The founder's bug: one letter used to close the tooltip (CM only
    // matches 1-char queries at a label's first character — our labels
    // started with "@").
    await page.keyboard.type("y");
    await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator(".cm-tooltip-autocomplete li").first(),
    ).toContainText("@yuki");
  });
});
