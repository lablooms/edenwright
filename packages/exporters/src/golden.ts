import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Golden-file helper for exporter tests (AGENTS.md: exporters especially).
 * Byte-exact for text formats; structural (re-opened zip parts) for docx/EPUB.
 * Regenerate with UPDATE_GOLDEN=1 pnpm test.
 */

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "golden");

export function goldenPath(name: string): string {
  return join(GOLDEN_DIR, name);
}

export function readGolden(name: string): string {
  return readFileSync(goldenPath(name), "utf8");
}

export function expectGolden(name: string, actual: string): void {
  const path = goldenPath(name);
  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
    return;
  }
  const expected = readFileSync(path, "utf8");
  if (actual !== expected) {
    throw new Error(
      `Golden mismatch for ${name}:\n--- expected ---\n${expected.slice(0, 400)}\n--- actual ---\n${actual.slice(0, 400)}`,
    );
  }
}

export const PROSE_FIXTURE = {
  projectName: "Hollow Crown",
  author: "Lablooms",
  sections: [
    {
      path: "Projects/Hollow Crown/manuscript/fall.md",
      title: "The Long Way Down",
      body: "Yuki counted **ninety-nine** steps as she fell.\n\nThe city did not forgive heights.\n",
      kind: "manuscript" as const,
      frontmatter: { title: "The Long Way Down" },
    },
    {
      path: "Projects/Hollow Crown/manuscript/door.md",
      title: "The Door",
      body: "The door was not there yesterday.\n\n> Doors are just decisions you can open.\n",
      kind: "manuscript" as const,
      frontmatter: { title: "The Door" },
    },
  ],
};
