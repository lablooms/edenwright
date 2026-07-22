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

declare const PointerEvent: new (
  type: string,
  init: {
    pointerId?: number;
    bubbles?: boolean;
    clientX?: number;
    clientY?: number;
    buttons?: number;
  },
) => Event;

interface ElementLike {
  textContent: string | null;
  getBoundingClientRect(): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dispatchEvent(event: Event): void;
}
declare const document: {
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[];
};

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// M5 slice 4 (§7.7): corkboard cards with synopsis/status, drag to reorder
// persisted to project.json; outliner drag-to-restructure.
test.describe("M5 — Corkboard & outliner", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5k-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M5K Eden"),
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
        "Projects/Hollow Crown/manuscript/a-fall.md",
        '---\ntitle: "The Fall"\nsynopsis: "Yuki falls down the stairwell."\nstatus: final\n---\nShe falls.\n',
        null,
      );
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/b-door.md",
        '---\ntitle: "The Door"\nsynopsis: "A door appears mid-air."\nstatus: draft\n---\nIt opens.\n',
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("cards show synopsis and status color; drag persists order", async () => {
    // Renderer readiness: the bundle sets __ewStores at module load.
    await expect(page.locator(".ew-sidebar")).toBeVisible({ timeout: 30000 });
    await page.evaluate(() =>
      window.__ewStores.app.getState().setMainView("corkboard"),
    );

    // Cards with synopses and status chips.
    await expect(page.locator(".corkboard__card")).toHaveCount(2);
    await expect(
      page.locator(".corkboard__card-synopsis").first(),
    ).toContainText("Yuki falls down the stairwell.");
    await expect(page.locator(".ew-status--final")).toContainText("final");
    await expect(page.locator(".ew-status--draft")).toContainText("draft");

    // Drag The Fall onto The Door (moves it after).
    const fall = page.locator(".corkboard__card", { hasText: "The Fall" });
    const door = page.locator(".corkboard__card", { hasText: "The Door" });
    const fallBox = await fall.boundingBox();
    const doorBox = await door.boundingBox();
    if (!fallBox || !doorBox) throw new Error("no boxes");
    await page.mouse.move(fallBox.x + 20, fallBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(doorBox.x + 20, doorBox.y + 10, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(".ew-toast")).toContainText("Order saved", {
      timeout: 8000,
    });

    const manifest = JSON.parse(
      await readFile(
        join(sandbox, "M5K Eden", "Projects", "Hollow Crown", "project.json"),
        "utf8",
      ),
    );
    expect(manifest.order).toEqual([
      "Projects/Hollow Crown/manuscript/b-door.md",
      "Projects/Hollow Crown/manuscript/a-fall.md",
    ]);
  });

  test("outliner: drag a file onto a directory moves it", async () => {
    await page.evaluate(() =>
      window.__ewStores.app.getState().setMainView("editor"),
    );
    // Expand the project and notes dir via the tree.
    await page
      .locator(".file-tree__row", { hasText: "Hollow Crown" })
      .first()
      .click();
    await page.locator(".file-tree__row", { hasText: "manuscript" }).click();

    const fall = page.locator(".file-tree__row--file", {
      hasText: "a-fall.md",
    });
    const notes = page.locator(".file-tree__row--dir", { hasText: "notes" });
    await expect(fall).toBeVisible();
    await expect(notes).toBeVisible();

    // Synthesized pointer events — the OS mouse is unreliable under load.
    await page.evaluate(() => {
      const from = [...document.querySelectorAll(".file-tree__row--file")].find(
        (row) => row.textContent?.includes("a-fall.md"),
      );
      const to = [...document.querySelectorAll(".file-tree__row--dir")].find(
        (row) => row.textContent?.includes("notes"),
      );
      if (!from || !to) throw new Error("drag endpoints missing");
      const fromBox = from.getBoundingClientRect();
      const toBox = to.getBoundingClientRect();
      const fire = (target: ElementLike, type: string, x: number, y: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: x,
            clientY: y,
            buttons: 1,
            pointerId: 1,
          }),
        );
      fire(from, "pointerdown", fromBox.x + 30, fromBox.y + 5);
      fire(
        window as unknown as ElementLike,
        "pointermove",
        fromBox.x + 60,
        fromBox.y + 30,
      );
      fire(
        window as unknown as ElementLike,
        "pointermove",
        toBox.x + 30,
        toBox.y + 5,
      );
      fire(
        window as unknown as ElementLike,
        "pointerup",
        toBox.x + 30,
        toBox.y + 5,
      );
    });
    await expect(
      page.locator(".ew-toast", { hasText: "Moved to" }),
    ).toBeVisible({ timeout: 8000 });

    const moved = await readFile(
      join(
        sandbox,
        "M5K Eden",
        "Projects",
        "Hollow Crown",
        "notes",
        "a-fall.md",
      ),
      "utf8",
    );
    expect(moved).toContain("She falls.");
  });
});
