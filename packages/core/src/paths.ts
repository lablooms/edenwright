/**
 * Pure path helpers. Core treats every path as a POSIX-style string with
 * forward slashes; platform adapters translate to OS paths at the boundary.
 * This file must never import `node:path` (Portable Core Law, SPEC §5.3).
 */

/** Convert backslashes, collapse duplicate separators, strip trailing slash. */
export function normalizePath(path: string): string {
  let result = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (result.length > 1 && result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}

/** True for `/abs/posix` and `C:/windows` style roots. */
export function isAbsolutePath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized);
}

/** Join segments with single forward slashes, ignoring empties. */
export function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      const normalized = normalizePath(part);
      // Only the first segment may keep a leading slash (root or drive).
      return index === 0
        ? normalized.replace(/\/*$/, "")
        : normalized.replace(/^\/+|\/+$/g, "");
    })
    .filter((part) => part.length > 0)
    .join("/");
  return joined === "" ? "." : joined;
}

/** Final segment of a path. */
export function basename(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

/** Everything before the final segment, or "." for bare names. */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index === -1) return ".";
  if (index === 0) return "/";
  return normalized.slice(0, index);
}

/** Extension including the dot, lowercased; "" when none. */
export function extname(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  // A leading dot is a hidden-file marker, not an extension.
  if (index <= 0) return "";
  return name.slice(index).toLowerCase();
}

/**
 * Path of `to` relative to directory `from`, both normalized. Returns "." when
 * identical. Purely lexical — does not consult the file system.
 */
export function relativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split("/");
  const toParts = normalizePath(to).split("/");

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const ups = fromParts.slice(common).map(() => "..");
  const downs = toParts.slice(common);
  const parts = [...ups, ...downs];
  return parts.length === 0 ? "." : parts.join("/");
}
