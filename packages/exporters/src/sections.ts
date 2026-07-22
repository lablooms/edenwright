import type { FileSystemAdapter } from "@edenwright/core";
import { kindFromPath, parseMarkdown, walkFiles } from "@edenwright/core";

/**
 * The shared content model behind every export: ordered sections from a
 * container (project or world), addressed adapter-relative. Frontmatter
 * stays available (POV, status, storyDate) but never prints as YAML in
 * reader-facing formats.
 */

export interface ExportSection {
  /** Adapter-relative path of the source file (eden-relative here). */
  path: string;
  /** Frontmatter title, or heading, or filename. */
  title: string;
  /** Markdown body (frontmatter stripped). */
  body: string;
  kind: "manuscript" | "codex" | "note";
  frontmatter: Record<string, unknown>;
}

const DEFAULT_IGNORE = [".eden", ".git", "exports", "node_modules"];

/**
 * Collect markdown sections from a directory tree, adapter-relative.
 * `order` (paths from project.json) wins; the rest sort by path.
 */
export async function collectSections(
  fs: FileSystemAdapter,
  containerRelPath: string,
  order: readonly string[] = [],
): Promise<ExportSection[]> {
  const files = await walkFiles(fs, containerRelPath, {
    ignoreDirs: DEFAULT_IGNORE,
    extensions: [".md"],
  });

  const rank = new Map(order.map((path, index) => [path, index]));
  const sorted = files.sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || a.localeCompare(b);
  });

  const sections: ExportSection[] = [];
  for (const path of sorted) {
    const text = await fs.readFile(path);
    const { data, body } = parseMarkdown(text);
    const heading = /^#{1,6}\s+(.+?)\s*$/m.exec(body);
    const fileName = path
      .slice(path.lastIndexOf("/") + 1)
      .replace(/\.md$/i, "");
    sections.push({
      path,
      title:
        (typeof data.title === "string" && data.title) ||
        (typeof data.name === "string" && data.name) ||
        heading?.[1] ||
        fileName,
      body,
      kind: kindFromPath(path),
      frontmatter: data,
    });
  }
  return sections;
}
