import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

import { app } from "electron";

import { EdenwrightError } from "@edenwright/core";

/**
 * Bundled first-party seeds (SPEC v2 §7): `plugins/seed/` and `themes/`
 * ship inside the app, so the community tab's first-party installs work
 * offline. Reads are allow-listed to those two roots — never a free path.
 */

const ALLOWED_ROOTS = ["plugins/seed", "themes"];

function bundleBase(): string {
  // Packaged: extraResources land in resources/bundle. Dev: the repo root.
  return app.isPackaged
    ? join(process.resourcesPath, "bundle")
    : join(app.getAppPath(), "..", "..");
}

export async function readBundled(relPath: string): Promise<string> {
  const normalized = normalize(relPath).replaceAll(sep, "/");
  if (
    normalized.includes("..") ||
    !ALLOWED_ROOTS.some(
      (root) => normalized === root || normalized.startsWith(`${root}/`),
    )
  ) {
    throw new EdenwrightError(
      "IO",
      `Bundled reads only cover ${ALLOWED_ROOTS.join(" and ")}.`,
    );
  }
  try {
    return await readFile(join(bundleBase(), normalized), "utf8");
  } catch {
    throw new EdenwrightError("NOT_FOUND", `No bundled file at ${normalized}.`);
  }
}
