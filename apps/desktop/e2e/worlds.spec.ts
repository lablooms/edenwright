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

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// M5 done-when (SPEC §12): a novel and a comic in one eden share a world's
// cast — linked-world entities in both projects' @-completion, badged (§7.5).
test.describe("M5 — Worlds & cross-project linking", () => {
  let sandbox: string;
  let app: ElectronApplication;
  let page: Page;

  async function linkWorld(projectName: string, worldName: string) {
    await page.evaluate(
      async ([project, world]) => {
        const projects = await window.edenwright.projects.list();
        const found = projects.find((item) => item.name === project);
        await window.edenwright.projects.update(project, {
          linkedWorlds: [...(found?.linkedWorlds ?? []), world],
        });
      },
      [projectName, worldName] as const,
    );
  }

  test.beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-e2e-m5w-"));
    app = await electron.launch({
      args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
      cwd: appRoot,
      env: { ...process.env, EDENWRIGHT_TEST: "1" },
    });
    page = await app.firstWindow();

    await page.evaluate(
      (parent) => window.edenwright.eden.create(parent, "M5W Eden"),
      sandbox.replace(/\\/g, "/"),
    );
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    await page.evaluate(async () => {
      await window.edenwright.worlds.create("Aster Reach");
      await window.edenwright.files.write(
        "Worlds/Aster Reach/codex/yuki.md",
        "---\nid: ent_yuki\ntype: character\nname: Yuki Harrow\n---\nBackstory.\n",
        null,
      );
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
      await window.edenwright.projects.create({
        name: "Aster Manga",
        preset: "manga",
        medium: "comic",
        scaffold: [{ path: "pages" }, { path: "codex" }, { path: "notes" }],
      });
      await window.edenwright.files.write(
        "Projects/Hollow Crown/manuscript/scene one.md",
        "# The Long Way Down\n\n",
        null,
      );
      await window.edenwright.files.write(
        "Projects/Aster Manga/manuscript/page one.md",
        "PAGE 1\n\n",
        null,
      );
      await window.edenwright.test!.whenRebuilt();
    });
  });

  test.afterAll(async () => {
    await app?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  test("a novel and a comic share a world's cast, badged in @-completion", async () => {
    await linkWorld("Hollow Crown", "Aster Reach");
    await linkWorld("Aster Manga", "Aster Reach");

    // Novel scene: @ completes the world entity with the world badge.
    await page.evaluate(() =>
      (
        (window as unknown as Record<string, unknown>).__ewStores as {
          app: { getState(): { openFileAt(path: string): Promise<void> } };
        }
      ).app
        .getState()
        .openFileAt("Projects/Hollow Crown/manuscript/scene one.md"),
    );
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      "The Long Way Down",
    );
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("@yuk");
    await page.waitForTimeout(600);
    const novelOption = page.locator(".cm-tooltip-autocomplete li").first();
    await expect(novelOption).toContainText("@yuki");
    await expect(novelOption).toContainText("Yuki Harrow · Aster Reach");
    await page.keyboard.press("Escape");

    // Comic page: the same world's cast, badged the same way.
    await page.evaluate(() =>
      (
        (window as unknown as Record<string, unknown>).__ewStores as {
          app: { getState(): { openFileAt(path: string): Promise<void> } };
        }
      ).app
        .getState()
        .openFileAt("Projects/Aster Manga/manuscript/page one.md"),
    );
    await expect(page.locator(".markdown-editor .cm-content")).toContainText(
      "PAGE 1",
    );
    await page.locator(".markdown-editor .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("@yuk");
    await page.waitForTimeout(600);
    const comicOption = page.locator(".cm-tooltip-autocomplete li").first();
    await expect(comicOption).toContainText("@yuki");
    await expect(comicOption).toContainText("Yuki Harrow · Aster Reach");
    await page.keyboard.press("Escape");
  });

  test("promote an entity from a project to the world", async () => {
    await page.evaluate(async () => {
      await window.edenwright.files.write(
        "Projects/Hollow Crown/codex/mira.md",
        "---\nid: ent_mira\ntype: character\nname: Mira Sol\n---\nNotes.\n",
        null,
      );
    });
    await page.evaluate(() => window.edenwright.test!.whenRebuilt());
    const target = await page.evaluate(() =>
      window.edenwright.entities.promoteToWorld(
        "Projects/Hollow Crown/codex/mira.md",
        "Aster Reach",
      ),
    );
    expect(target).toBe("Worlds/Aster Reach/codex/mira.md");

    // The promoted entity completes from the novel too (via the world).
    const entities = await page.evaluate(() =>
      window.edenwright.entities.forProject("Hollow Crown"),
    );
    expect(
      entities.some(
        (entity) =>
          entity.name === "Mira Sol" && entity.world === "Aster Reach",
      ),
    ).toBe(true);
  });
});
