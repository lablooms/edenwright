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

// M5 slice 3 (§7.6): two tracks, drag to adjust dates, advisory collisions.
test.describe("M5 — Timeline", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5t-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M5T Eden"),
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
        "Projects/Hollow Crown/manuscript/fall.md",
        '---\ntitle: "The Fall"\nstoryDate: 1042-03-17\n---\n@yuki fell.\n',
        null,
      );
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/door.md",
        '---\ntitle: "The Door"\nstoryDate: 1042-03-17\n---\n@yuki found the door.\n',
        null,
      );
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/steps.md",
        '---\ntitle: "The Steps"\nstoryDate: 1042-03-20\n---\nShe climbed.\n',
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("scenes plot on both tracks with an advisory collision flag", async () => {
    await page.evaluate(() =>
      (
        (window as unknown as Record<string, unknown>).__ewStores as {
          app: { getState(): { setMainView(view: "timeline"): void } };
        }
      ).app
        .getState()
        .setMainView("timeline"),
    );

    // Three markers on the date track; the two same-day scenes flag @yuki.
    await expect(
      page.locator(".timeline__track").first().locator(".timeline__marker"),
    ).toHaveCount(3);
    await expect(page.locator(".timeline__warning")).toContainText("1 flag");
    await expect(page.locator(".timeline__marker[data-flagged]")).toHaveCount(
      2,
    );
    // Narrative track mirrors them.
    await expect(
      page.locator(".timeline__track--narrative .timeline__marker"),
    ).toHaveCount(3);
  });

  test("dragging a date marker rewrites storyDate in frontmatter", async () => {
    // Synthesized pointer events — deterministic on every CI runner, no
    // dependence on OS-level mouse hit-testing.
    await page.evaluate(() => {
      const track = document.querySelector(".timeline__track");
      const marker = [...document.querySelectorAll(".timeline__marker")].find(
        (el) => el.textContent?.includes("The Steps"),
      );
      if (!track || !marker) throw new Error("marker not found");
      const trackRect = track.getBoundingClientRect();
      const rect = marker.getBoundingClientRect();
      const startX = rect.x + rect.width / 2;
      const startY = rect.y + rect.height / 2;
      const endX = trackRect.x + 12;
      const fire = (
        type: string,
        target: ElementLike,
        x: number,
        y: number,
      ) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            bubbles: true,
            clientX: x,
            clientY: y,
            buttons: 1,
          }),
        );
      };
      const win = window as unknown as ElementLike;
      fire("pointerdown", marker, startX, startY);
      for (let i = 1; i <= 8; i += 1) {
        const x = startX + ((endX - startX) * i) / 8;
        fire("pointermove", win, x, startY);
      }
      fire("pointerup", win, endX, startY);
    });
    await expect(page.locator(".ew-toast")).toContainText("storyDate", {
      timeout: 8000,
    });

    const onDisk = await readFile(
      join(
        sandbox,
        "M5T Eden",
        "Projects",
        "Hollow Crown",
        "manuscript",
        "steps.md",
      ),
      "utf8",
    );
    expect(onDisk).toContain("storyDate: 1042-03-17");
  });
});
