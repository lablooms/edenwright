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

// W4 (founder): the writing workspace must feel like writing — Tab indents
// instead of escaping to the next control, Enter continues structures.
test.describe("W4 — Writing feel", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-w4-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await createTestEden(page, sandbox, "W4 Eden");
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "manuscript/scene.md",
        "The first line.\n\n- one\n- two",
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
    await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });
    await page.evaluate(() =>
      window.__ewStores.app.getState().openFileAt("manuscript/scene.md"),
    );
    await page.locator(".cm-content").click();
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  const lineTexts = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".cm-line")].map(
        (line) =>
          (line as { textContent?: string }).textContent?.replace(/ /g, " ") ??
          "",
      ),
    );

  test("Tab indents the line and focus stays in the editor", async () => {
    // Click INTO the first line's text — a bare .cm-content click can land
    // the caret at the doc end (below the text), which indents the wrong line.
    await page.locator(".cm-line").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    expect((await lineTexts())[0]).toBe("  The first line.");
    // Focus did NOT escape to another control (the founder's complaint).
    const focused = await page.evaluate(
      () =>
        (
          document as unknown as {
            activeElement?: { className?: string };
          }
        ).activeElement?.className ?? "",
    );
    expect(focused).toContain("cm-content");
  });

  test("Shift-Tab outdents back", async () => {
    // Tests share one editor — compare against the CURRENT indent, not a
    // fixed expectation (the previous test indented already).
    await page.locator(".cm-line").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    const indented = (await lineTexts())[0];
    const depth = indented.length - indented.trimStart().length;
    expect(depth).toBeGreaterThan(0);
    await page.keyboard.press("Shift+Tab");
    const after = (await lineTexts())[0];
    expect(after.length - after.trimStart().length).toBe(depth - 2);
  });

  test("Enter continues a bullet list", async () => {
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    const bullets = (await lineTexts()).filter((text) => text.startsWith("- "));
    expect(bullets.length).toBe(3);
  });

  test("brackets auto-close (quotes curl instead — smart typography)", async () => {
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("(paren");
    const texts = await lineTexts();
    expect(texts[texts.length - 1]).toBe("(paren)");
  });
});
