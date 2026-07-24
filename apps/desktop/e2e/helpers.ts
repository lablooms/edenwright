import type { Page } from "@playwright/test";

/**
 * Shared e2e setup helpers. One eden = one project = one world: a single
 * `eden.create` call lays down the manifest, the preset scaffold at the
 * root, and `world/{codex,notes,maps}` — no projects.create/worlds.create.
 */

export interface TestEdenOptions {
  preset?: string;
  medium?: string;
  /** Story scaffold at the eden root (world/ and exports/ are automatic). */
  scaffold?: { path: string; contents?: string }[];
}

export const NOVEL_SCAFFOLD = [{ path: "manuscript" }, { path: "notes" }];

/** Create an eden through the bridge and wait for the index to settle. */
export async function createTestEden(
  page: Page,
  parentDir: string,
  name: string,
  opts: TestEdenOptions = {},
): Promise<void> {
  await page.evaluate(
    ([parent, edenName, input]) =>
      window.edenwright.eden
        .create(parent, edenName, input)
        .then(() => undefined),
    [
      parentDir.replace(/\\/g, "/"),
      name,
      {
        preset: opts.preset ?? "novel",
        medium: opts.medium ?? "prose",
        scaffold: opts.scaffold ?? NOVEL_SCAFFOLD,
      },
    ] as const,
  );
  await page.evaluate(() => window.edenwright.test!.whenRebuilt());
}
