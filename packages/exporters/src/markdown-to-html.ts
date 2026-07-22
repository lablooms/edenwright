import { parseMarkdown } from "@edenwright/core";

/**
 * A small, honest Markdown → XHTML converter for exports (SPEC §10). Not a
 * full markdown engine — the prose constructs of a writing app, done right
 * and tested. `%%comments%%` never leave the app (§7.1).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // [text](url) → link text; [[wiki]] → link text; @mention → plain.
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  out = out.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target: string, alias: string) => alias ?? target,
  );
  return out;
}

/** Convert one markdown document (frontmatter already tolerated) to XHTML body content. */
export function markdownToHtml(markdown: string): string {
  const { body } = parseMarkdown(markdown);
  const withoutComments = body.replace(/%%[^\n]*?%%/g, "");
  const lines = withoutComments.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let inFence = false;
  let fenceLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      html.push(
        `<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`,
      );
      list = [];
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inFence) {
        html.push(
          `<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`,
        );
        fenceLines = [];
        inFence = false;
      } else {
        flushParagraph();
        flushList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      html.push(
        `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`,
      );
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      html.push(
        `<blockquote><p>${inline(trimmed.slice(1).trim())}</p></blockquote>`,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    if (/^(---+|\*\*\*+)$/.test(trimmed)) {
      flushParagraph();
      flushList();
      html.push("<hr/>");
      continue;
    }
    paragraph.push(trimmed);
  }

  if (inFence) {
    html.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}
