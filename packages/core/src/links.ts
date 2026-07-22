import { normalizePath } from "./paths.js";

/**
 * Wiki-link target resolution (SPEC §6.1). Links are written as `[[Title]]`
 * or `[[stable-id]]` and resolved against the index — renames keep working
 * because stable IDs live in frontmatter, and the link-updater (M5) rewrites
 * files on rename with a snapshot first.
 */

export interface LinkTargetFile {
  /** Eden-relative normalized path. */
  path: string;
  title: string;
  stableId: string | null;
}

function stem(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}

/**
 * Resolve a raw `[[target]]` to a file path, or null when unresolved.
 * Precedence: exact path → stable ID → title (case-insensitive) → filename
 * stem (case-insensitive). Ties break by path, so results are deterministic.
 */
export function resolveLinkTarget(
  raw: string,
  files: readonly LinkTargetFile[],
): string | null {
  const needle = raw.trim();
  if (needle.length === 0) return null;
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  const asPath = normalizePath(needle);
  const withExt = asPath.toLowerCase().endsWith(".md")
    ? asPath
    : `${asPath}.md`;
  const byPath = sorted.find(
    (file) => file.path === asPath || file.path === withExt,
  );
  if (byPath) return byPath.path;

  const byId = sorted.find((file) => file.stableId === needle);
  if (byId) return byId.path;

  const lowered = needle.toLowerCase();
  const byTitle = sorted.find((file) => file.title.toLowerCase() === lowered);
  if (byTitle) return byTitle.path;

  const byStem = sorted.find(
    (file) => stem(file.path).toLowerCase() === lowered,
  );
  return byStem ? byStem.path : null;
}
