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

// M5 slice 1 (§7.4): codex browser, designed sheets, appearances.
test.describe("M5 — Codex sheets & appearances", () => {
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

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M5C Eden"),
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
      await window.edenwright.files.write(
        "Projects/Hollow Crown/codex/yuki.md",
        '---\nid: ent_yuki\ntype: character\nname: Yuki Harrow\naliases: ["The Gray Fox"]\nfields:\n  age: 27\n---\nBackstory.\n',
        null,
      );
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/scene one.md",
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

  test("codex browser groups entities by type", async () => {
    await page.locator(".ew-sidebar__item[title='Codex']").click();
    await expect(page.locator(".codex-panel")).toBeVisible();
    await expect(page.locator(".codex-panel__group-title")).toContainText(
      "Character",
    );
    await expect(page.locator(".codex-panel__entity-name")).toContainText(
      "Yuki Harrow",
    );
    await expect(page.locator(".codex-panel__entity-alias")).toContainText(
      "The Gray Fox",
    );
  });

  test("designed sheet: fields, aliases, appearances — not raw frontmatter", async () => {
    await page.locator(".codex-panel__entity-name").click();

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

    // Appearances with counts (§7.4).
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

  test("editing a field saves typed frontmatter; new entity from the panel", async () => {
    await page.locator(".codex-panel__entity-name").click();
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
      join(sandbox, "M5C Eden", "Projects", "Hollow Crown", "codex", "yuki.md"),
      "utf8",
    );
    expect(onDisk).toContain("age: 28");

    // New entity via the panel's inline form.
    await page.locator(".codex-panel__new").click();
    await page.locator(".codex-panel__type", { hasText: "Place" }).click();
    await page.locator(".codex-panel__name").fill("Aster Reach");
    await page.keyboard.press("Enter");
    await expect(page.locator(".codex-sheet__name")).toHaveValue(
      "Aster Reach",
      {
        timeout: 8000,
      },
    );
    const placeOnDisk = await readFile(
      join(
        sandbox,
        "M5C Eden",
        "Projects",
        "Hollow Crown",
        "codex",
        "Aster Reach.md",
      ),
      "utf8",
    );
    expect(placeOnDisk).toContain("type: place");
  });

  test("@-completion stays open from the first letter (W1)", async () => {
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/completion probe.md",
        "The fox ran. ",
        null,
      );
      await window.__ewStores.app
        .getState()
        .openFileAt("Projects/Hollow Crown/manuscript/completion probe.md");
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

  test("codex panel filter narrows by name and alias", async () => {
    await page.locator('.ew-sidebar button[aria-label="Codex"]').click();
    await expect(page.locator(".codex-panel__filter")).toBeVisible();
    await page.locator(".codex-panel__filter").fill("gray fox");
    await expect(page.locator(".codex-panel__entity-name")).toHaveCount(1);
    await expect(page.locator(".codex-panel__entity-name")).toContainText(
      "Yuki Harrow",
    );
    await page.locator(".codex-panel__filter").fill("nobody");
    await expect(page.locator(".codex-panel__entity-name")).toHaveCount(0);
    await expect(page.locator(".codex-panel")).toContainText(
      "Nothing named “nobody” grows here.",
    );
  });
});
