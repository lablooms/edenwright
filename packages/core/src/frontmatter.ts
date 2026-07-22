import { parse, stringify } from "yaml";

/**
 * Markdown + YAML frontmatter (SPEC §6.1). Parsing never throws on bad YAML —
 * a corrupt block must not swallow the user's words; it is reported instead.
 */

export interface ParsedMarkdown {
  /** Frontmatter fields; empty object when absent or unparseable. */
  data: Record<string, unknown>;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** 1-based line in the original text where `body` begins. */
  bodyStartLine: number;
  hasFrontmatter: boolean;
  /** Set when a frontmatter block exists but its YAML is invalid. */
  frontmatterError?: string;
}

const FRONTMATTER_RE =
  /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseMarkdown(text: string): ParsedMarkdown {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { data: {}, body: text, bodyStartLine: 1, hasFrontmatter: false };
  }

  const body = text.slice(match[0].length);
  let bodyStartLine = 1;
  for (let i = 0; i < match[0].length; i += 1) {
    if (text.charCodeAt(i) === 10) bodyStartLine += 1;
  }

  let data: unknown;
  try {
    data = parse(match[1]);
  } catch (error) {
    return {
      data: {},
      body: text,
      bodyStartLine: 1,
      hasFrontmatter: false,
      frontmatterError: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { data: {}, body, bodyStartLine, hasFrontmatter: true };
  }
  return {
    data: data as Record<string, unknown>,
    body,
    bodyStartLine,
    hasFrontmatter: true,
  };
}

/**
 * Serialize frontmatter + body. Empty data yields the bare body — no empty
 * `--- ---` litter. Key order follows the object's insertion order, so diffs
 * stay stable (SPEC §6.3 spirit).
 */
export function serializeMarkdown(
  data: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(data).length === 0) return body;
  const yaml = stringify(data).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}
