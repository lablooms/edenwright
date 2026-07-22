/**
 * Dev-time visual check: launches the built app, creates an eden with a
 * markdown showcase file, opens it, and screenshots the editor (plus the
 * palette and search panel). Not a test — a manual inspection tool.
 * Usage: node scripts/snap-editor.mjs
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const outDir = join(appRoot, "e2e", "artifacts");

const sandbox = await mkdtemp(join(tmpdir(), "edenwright-snap-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();

  await page.evaluate(
    (parent) => window.edenwright.eden.create(parent, "Snap Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());

  const showcase = [
    "---",
    "id: scn_1",
    'title: "The Long Way Down"',
    "status: draft",
    "---",
    "# The Long Way Down",
    "",
    "Yuki counted the steps as she fell. **Ninety-nine**, *one hundred* — she was sure of it.",
    "",
    "> The city does not forgive heights, @mira had said.",
    "",
    "She thought of [[The Gray Fox]] and his `silver_key`, and of %%the chapter I deleted%% nothing at all.",
    "",
    "## A small heading",
    "",
    "Straight quotes curl as you type... try it.",
  ].join("\n");

  await page.evaluate(
    ([path, text]) => window.edenwright.files.write(path, text, null),
    ["Projects/showcase.md", showcase],
  );
  await page.evaluate(() =>
    window.edenwright.files.read("Projects/showcase.md"),
  );
  await page.locator(".file-tree__row", { hasText: "showcase.md" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, "m2-editor.png") });

  // Palette
  await page.keyboard.press("Control+p");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "m2-palette.png") });
  await page.keyboard.press("Escape");

  // Search panel
  await page.keyboard.press("Control+Shift+f");
  await page.locator(".search-panel__input").fill("steps");
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, "m2-search.png") });

  // Focus mode
  await page.locator(".markdown-editor .cm-content").click();
  await page.keyboard.press("Control+Shift+Enter");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, "m2-focus.png") });

  console.log("snapshots written to", outDir);
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
