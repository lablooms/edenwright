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

// CodeMirror's "Mod" maps to Cmd on macOS, Ctrl elsewhere (App-level
// hotkeys accept both, but the editor's save keymap is platform-mapped).
const MOD = process.platform === "darwin" ? "Meta" : "Control";

// M2 (SPEC §12): CM6 live preview, smart typography, palette, search,
// focus mode — "a folder of markdown is a pleasant writing app".
test.describe("M2 — editor & navigation", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m2-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "M2 Eden");

    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "manuscript/showcase.md",
        '---\ntitle: "The Long Way Down"\n---\n# The Long Way Down\n\nYuki counted the steps. **Ninety-nine** — she was sure.\n\nShe thought of [[Yuki Harrow]].\n',
      ] as const,
    );
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "world/codex/yuki.md",
        '---\nid: ent_yuki\ntype: character\nname: "Yuki Harrow"\n---\nBackstory.\n',
      ] as const,
    );

    // Only world/ starts expanded — open manuscript to reach the file.
    // (Store toggle: a DOM click can race a tree refresh from the watcher.)
    await page.evaluate(() =>
      window.__ewStores.app.getState().toggleExpanded("manuscript"),
    );
    await page.locator(".file-tree__row", { hasText: "showcase.md" }).click();
    await expect(page.locator(".markdown-editor .cm-content")).toBeVisible();
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("live preview renders formatting", async () => {
    await expect(page.locator(".cm-ew-h1")).toContainText("The Long Way Down");
    await expect(page.locator(".cm-ew-strong")).toContainText("Ninety-nine");
    await expect(page.locator(".cm-ew-wikilink")).toContainText("Yuki Harrow");
  });

  test("smart typography curls as you type", async () => {
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type('She said "hello" -- then left...');
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      "She said “hello” — then left…",
    );
    // Clean up the typed line so later assertions stay stable.
    await page.evaluate(() => {
      const current = window.edenwright.files;
      return current.read("manuscript/showcase.md").then(() => undefined);
    });
  });

  test("[[ opens file completion from the index", async () => {
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("[[Yuk");
    await page.waitForTimeout(600);
    await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible();
    await expect(
      page.locator(".cm-tooltip-autocomplete li").first(),
    ).toContainText("Yuki Harrow");
    await page.keyboard.press("Escape");
  });

  test("quick switcher lists files and commands", async () => {
    await page.keyboard.press("Control+p");
    await expect(page.locator(".palette")).toBeVisible();
    await expect(page.locator(".palette__row").first()).toBeVisible();
    await page.locator(".palette__input").fill("codex");
    await expect(
      page.locator(".palette__row", { hasText: "yuki" }).first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".palette")).not.toBeVisible();
  });

  test("global search finds and marks", async () => {
    await page.keyboard.press("Control+Shift+f");
    await expect(page.locator(".search-panel")).toBeVisible();
    await page.locator(".search-panel__input").fill("steps");
    await expect(page.locator(".search-panel__hit").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(".search-panel__mark").first()).toContainText(
      "steps",
    );
  });

  test("focus mode fades the chrome and exits on Escape", async () => {
    await page.keyboard.press("Control+Shift+Enter");
    await expect(page.locator(".app-shell--focus")).toBeVisible();
    await expect(page.locator(".cm-ew-focus-dim").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-shell--focus")).not.toBeVisible();
  });

  test("Ctrl+S saves through the conflict-safe writer", async () => {
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("A saved sentence.");
    await page.keyboard.press(`${MOD}+s`);
    await expect(page.locator(".viewer__dirty-dot")).not.toBeVisible();
    const onDisk = await readFile(
      join(sandbox, "M2 Eden", "manuscript", "showcase.md"),
      "utf8",
    );
    expect(onDisk).toContain("A saved sentence.");
  });
});

// R4 — the writer toolkit: toolbar, hotkeys, guide, comfort settings,
// outline. For writers who have never heard of markdown.
test.describe("R4 — writer toolkit", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-r4-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "R4 Eden");
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "manuscript/format.md",
        "First plain line.\n\nSecond line here.\n\nThird line stays.\n",
      ] as const,
    );
    const filler = Array.from({ length: 200 }, () => "Filler line.").join("\n");
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "manuscript/long.md",
        `# Chapter One\n\n${filler}\n\n# Final Chapter\n`,
      ] as const,
    );
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/format.md"),
    );
    await expect(page.locator(".markdown-editor .cm-content")).toBeVisible();
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  const lineTexts = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".cm-line")].map(
        (line) => (line as { textContent?: string }).textContent ?? "",
      ),
    );

  /** Click into a line's text and select it whole (Home, then Shift+End). */
  const selectLine = async (index: number) => {
    await page.locator(".cm-line").nth(index).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
  };

  test("toolbar is up and Bold round-trips the selection", async () => {
    const bold = page.locator('.editor-toolbar button[title^="Bold"]');
    await expect(bold).toBeVisible();
    await selectLine(0);
    await bold.click();
    expect((await lineTexts())[0]).toBe("**First plain line.**");
    // Live preview wears the format, not just the codes.
    await expect(page.locator(".cm-ew-strong")).toContainText(
      "First plain line.",
    );
    await expect(bold).toHaveAttribute("data-active");
    // Same button again takes it off — an idempotent round-trip.
    await bold.click();
    expect((await lineTexts())[0]).toBe("First plain line.");
  });

  test("Ctrl+B bolds and unbolds", async () => {
    await selectLine(2);
    await page.keyboard.press(`${MOD}+b`);
    expect((await lineTexts())[2]).toBe("**Second line here.**");
    await page.keyboard.press(`${MOD}+b`);
    expect((await lineTexts())[2]).toBe("Second line here.");
  });

  test("Ctrl+1 toggles a heading", async () => {
    await page.locator(".cm-line").nth(4).click();
    await page.keyboard.press("Home");
    await page.keyboard.press(`${MOD}+1`);
    expect((await lineTexts())[4]).toBe("# Third line stays.");
    await expect(page.locator(".cm-ew-h1")).toContainText("Third line stays.");
    await page.keyboard.press(`${MOD}+1`);
    expect((await lineTexts())[4]).toBe("Third line stays.");
  });

  test("focus mode hides the toolbar, Escape brings it back", async () => {
    await page.keyboard.press("Control+Shift+Enter");
    await expect(page.locator(".app-shell--focus")).toBeVisible();
    await expect(page.locator(".editor-toolbar")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-toolbar")).toBeVisible();
  });

  test("writing guide opens from the Help menu and lists shortcuts", async () => {
    await page.locator('.ew-titlebar__button[title="Help"]').click();
    await page
      .locator(".help-menu__dropdown button", { hasText: "Writing guide" })
      .click();
    await expect(page.locator(".guide")).toBeVisible();
    await expect(page.locator(".guide__table")).toContainText("Ctrl/Cmd+B");
    await expect(page.locator(".guide__table")).toContainText("Focus mode");
    await page
      .locator(".guide__tab", { hasText: "How formatting works" })
      .click();
    await expect(page.locator(".guide__prose")).toContainText(
      "plain text files",
    );
    // Never the m-word in front of a writer.
    await expect(page.locator(".guide")).not.toContainText("markdown");
    await page.locator(".guide__footer button", { hasText: "Close" }).click();
    await expect(page.locator(".guide")).not.toBeVisible();
  });

  test("outline lists headings and a click scrolls there", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/long.md"),
    );
    await expect(page.locator(".markdown-editor .cm-content")).toBeVisible();
    const items = page.locator(".outline-section__item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveText("Chapter One");
    await expect(items.nth(1)).toHaveText("Final Chapter");
    // The ending is far below the fold — CodeMirror hasn't rendered it yet.
    await expect(
      page.locator(".cm-line", { hasText: "Final Chapter" }),
    ).toHaveCount(0);
    await items.nth(1).click();
    const target = page.locator(".cm-line", { hasText: "Final Chapter" });
    await expect(target).toBeInViewport();
  });

  test("outline shows its designed empty state on a heading-less file", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/format.md"),
    );
    await expect(page.locator(".outline-section__empty")).toContainText(
      "No headings yet",
    );
  });

  test("spellcheck + typewriter toggles persist to settings.json", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().setSettingsOpen(true),
    );
    await expect(page.locator(".settings")).toBeVisible();

    const spellcheck = page
      .locator(".settings__check", { hasText: "Check spelling" })
      .locator("input");
    const typewriter = page
      .locator(".settings__check", { hasText: "Typewriter scrolling" })
      .locator("input");
    // Defaults: spelling ON, typewriter OFF.
    await expect(spellcheck).toBeChecked();
    await expect(typewriter).not.toBeChecked();

    await spellcheck.click();
    await typewriter.click();
    await page
      .locator(".settings__footer button", { hasText: "Save settings" })
      .click();
    await expect(
      page.locator(".ew-toast", { hasText: "Settings saved." }).first(),
    ).toBeVisible();

    const onDisk = JSON.parse(
      await readFile(
        join(sandbox, "R4 Eden", ".eden", "settings.json"),
        "utf8",
      ),
    ) as { editor: { spellcheck: boolean; typewriterMode: boolean } };
    expect(onDisk.editor.spellcheck).toBe(false);
    expect(onDisk.editor.typewriterMode).toBe(true);

    // Back to defaults so other specs keep a clean baseline.
    await spellcheck.click();
    await typewriter.click();
    await page
      .locator(".settings__footer button", { hasText: "Save settings" })
      .click();
    await expect(
      page.locator(".ew-toast", { hasText: "Settings saved." }).first(),
    ).toBeVisible();
    await page
      .locator(".settings__footer button", { hasText: "Close" })
      .click();
  });

  test("comfort sliders restyle the editor through CSS vars", async () => {
    const varOnEditor = (name: string) =>
      page.evaluate(
        (varName) =>
          getComputedStyle(
            document.querySelector(".markdown-editor")!,
          ).getPropertyValue(varName),
        name,
      );
    expect(await varOnEditor("--ew-editor-font-size")).toBe("17px");
    expect(await varOnEditor("--ew-editor-line-width")).toBe("72ch");

    await page.evaluate(() =>
      window.__ewStores.app.getState().setSettingsOpen(true),
    );
    const fontSlider = page.locator(".settings__range").first();
    // Focus, never click: a click on a range input jumps to the click point.
    await fontSlider.focus();
    await page.keyboard.press("ArrowRight"); // 17 → 18
    const widthSlider = page.locator(".settings__range").nth(1);
    await widthSlider.focus();
    await page.keyboard.press("ArrowRight"); // 72 → 76
    await page
      .locator(".settings__footer button", { hasText: "Save settings" })
      .click();
    await expect(
      page.locator(".ew-toast", { hasText: "Settings saved." }).first(),
    ).toBeVisible();

    expect(await varOnEditor("--ew-editor-font-size")).toBe("18px");
    expect(await varOnEditor("--ew-editor-line-width")).toBe("76ch");
  });
});
