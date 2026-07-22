import type { FileSystemAdapter } from "./adapters/file-system.js";
import { joinPath } from "./paths.js";

export interface WalkOptions {
  /** Directory names to skip entirely, e.g. [".eden", ".git", "exports"]. */
  ignoreDirs?: string[];
  /** Lowercased extensions to include, e.g. [".md"]. Default: all files. */
  extensions?: string[];
}

/**
 * Recursively collect file paths under `dirPath`, returned as normalized
 * absolute paths in stable (sorted) order.
 */
export async function walkFiles(
  fs: FileSystemAdapter,
  dirPath: string,
  options: WalkOptions = {},
): Promise<string[]> {
  const ignoreDirs = new Set(options.ignoreDirs ?? []);
  const extensions = options.extensions ? new Set(options.extensions) : null;

  const results: string[] = [];

  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.list(dir);
    } catch {
      return; // Missing directory is not an error during a walk.
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = joinPath(dir, entry.name);
      if (entry.kind === "directory") {
        if (!ignoreDirs.has(entry.name)) await visit(path);
      } else if (entry.kind === "file") {
        const dot = entry.name.lastIndexOf(".");
        const ext = dot > 0 ? entry.name.slice(dot).toLowerCase() : "";
        if (!extensions || extensions.has(ext)) results.push(path);
      }
    }
  }

  await visit(dirPath);
  return results;
}
