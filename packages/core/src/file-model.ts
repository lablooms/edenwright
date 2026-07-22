import { basename } from "./paths.js";
import { parseMarkdown } from "./frontmatter.js";

/**
 * The file model: everything the index derives from a plain markdown file
 * (SPEC §6.1, §7.4). Pure functions — the indexer feeds these into storage.
 */

export type FileKind = "manuscript" | "codex" | "note";

/** Classify a file by its folder: `codex/` → entity, `notes/` → note, else manuscript. */
export function kindFromPath(relPath: string): FileKind {
  const segments = relPath.toLowerCase().split("/");
  if (segments.includes("codex")) return "codex";
  if (segments.includes("notes")) return "note";
  return "manuscript";
}

export interface DerivedLink {
  kind: "wiki" | "mention";
  /** Raw target text as written, e.g. "Chapter One" or "yuki". */
  targetRaw: string;
  /** 1-based line in the original text. */
  line: number;
}

export interface DerivedMention {
  /** Lowercased mention key, e.g. "yuki" for `@yuki`. */
  entityKey: string;
  count: number;
}

export interface DerivedFile {
  stableId: string | null;
  title: string;
  status: string | null;
  storyDate: string | null;
  wordCount: number;
  frontmatter: Record<string, unknown>;
  links: DerivedLink[];
  mentions: DerivedMention[];
}

/**
 * Blank out code fences and inline code (preserving newlines, so line numbers
 * stay true) — links, mentions, and words in code don't count.
 */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?(?:```|$)/g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
}

/** Unicode-aware word count over prose (code excluded). */
export function countWords(text: string): number {
  const prose = stripCode(text);
  const words = prose.match(/[\p{L}\p{N}]+(?:[’'–-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

const WIKI_LINK_RE = /\[\[([^\][|]+)(?:\|[^\]]*)?\]\]/g;
const MENTION_RE = /(^|[^\p{L}\p{N}@_])@([\p{L}][\p{L}\p{N}_-]*)/gu;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/m;

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalDateString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return optionalString(value);
}

/** Derive everything the index needs from one markdown file. */
export function deriveFile(fileName: string, text: string): DerivedFile {
  const { data, body, bodyStartLine } = parseMarkdown(text);
  const prose = stripCode(body);
  // Link lines are file-relative, not body-relative.
  const lineOffset = bodyStartLine - 1;

  const links: DerivedLink[] = [];
  for (const match of prose.matchAll(WIKI_LINK_RE)) {
    const targetRaw = match[1].trim();
    if (targetRaw.length === 0) continue;
    links.push({
      kind: "wiki",
      targetRaw,
      line: lineOffset + lineOf(prose, match.index),
    });
  }

  const mentionCounts = new Map<string, { count: number; firstLine: number }>();
  for (const match of prose.matchAll(MENTION_RE)) {
    const key = match[2].toLowerCase();
    const entry = mentionCounts.get(key) ?? {
      count: 0,
      firstLine: lineOffset + lineOf(prose, match.index),
    };
    entry.count += 1;
    mentionCounts.set(key, entry);
  }
  const mentions: DerivedMention[] = [...mentionCounts.entries()].map(
    ([entityKey, { count }]) => ({ entityKey, count }),
  );
  for (const [key, { firstLine }] of mentionCounts) {
    links.push({ kind: "mention", targetRaw: key, line: firstLine });
  }

  const heading = HEADING_RE.exec(body);
  // Codex entities name themselves with `name` (SPEC §6.2).
  const title =
    optionalString(data.title) ??
    optionalString(data.name) ??
    (heading ? heading[1] : null) ??
    basename(fileName).replace(/\.md$/i, "");

  return {
    stableId: optionalString(data.id),
    title,
    status: optionalString(data.status),
    storyDate: optionalDateString(data.storyDate),
    wordCount: countWords(body),
    frontmatter: data,
    links,
    mentions,
  };
}

/**
 * Conflict-copy file name (SPEC §5.4): when a file changed on disk underneath
 * the app, the app's version is saved beside it, never over it.
 * `scene.md` → `scene (conflicted copy 2026-07-21 01-23-45).md`
 */
export function conflictedCopyName(filePath: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds(),
  )}`;
  const slash = filePath.lastIndexOf("/");
  const dir = slash === -1 ? "" : `${filePath.slice(0, slash + 1)}`;
  const name = slash === -1 ? filePath : filePath.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${dir}${stem} (conflicted copy ${stamp})${ext}`;
}
