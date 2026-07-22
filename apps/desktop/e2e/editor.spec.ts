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

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M2 Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());

    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "Projects/showcase.md",
        '---\ntitle: "The Long Way Down"\n---\n# The Long Way Down\n\nYuki counted the steps. **Ninety-nine** — she was sure.\n\nShe thought of [[Yuki Harrow]].\n',
      ] as const,
    );
    await page.evaluate(
      ([path, text]) => window.edenwright.files.write(path, text, null),
      [
        "Projects/codex/yuki.md",
        '---\nid: ent_yuki\ntype: character\nname: "Yuki Harrow"\n---\nBackstory.\n',
      ] as const,
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
      return current.read("Projects/showcase.md").then(() => undefined);
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
      join(sandbox, "M2 Eden", "Projects", "showcase.md"),
      "utf8",
    );
    expect(onDisk).toContain("A saved sentence.");
  });
});
