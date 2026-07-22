import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Live-preview markdown (SPEC §7.1): formatting renders as you type; raw
 * syntax marks appear only around the cursor. Writers never feel they're
 * coding. Decorations are rebuilt only for visible ranges, so 500k-word
 * manuscripts stay cheap (§11).
 */

const FRONTMATTER_LINE_RE = /^---\s*$/;
const WIKI_RE = /\[\[[^\][|]+(?:\|[^\]]*)?\]\]/g;
const MENTION_RE = /(^|[^\p{L}\p{N}@_])@[\p{L}][\p{L}\p{N}_-]*/gu;
const COMMENT_RE = /%%[^\n]*?%%/g;

const hide = Decoration.replace({});
const markDim = Decoration.mark({ class: "cm-ew-mark-dim" });

const NODE_CLASSES: Record<string, string> = {
  Emphasis: "cm-ew-em",
  StrongEmphasis: "cm-ew-strong",
  Strikethrough: "cm-ew-strike",
  InlineCode: "cm-ew-inline-code",
  URL: "cm-ew-url",
};

const HEADING_CLASSES: Record<string, string> = {
  ATXHeading1: "cm-ew-h1",
  ATXHeading2: "cm-ew-h2",
  ATXHeading3: "cm-ew-h3",
  ATXHeading4: "cm-ew-h4",
  ATXHeading5: "cm-ew-h5",
  ATXHeading6: "cm-ew-h6",
  SetextHeading1: "cm-ew-h1",
  SetextHeading2: "cm-ew-h2",
};

const MARK_NODES = new Set([
  "EmphasisMark",
  "CodeMark",
  "HeaderMark",
  "QuoteMark",
  "StrikethroughMark",
]);

interface DecoItem {
  from: number;
  to: number;
  deco: Decoration;
  /** Line decorations must enter the RangeSet before marks at the same pos. */
  isLine: boolean;
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const items: DecoItem[] = [];
  const sel = state.selection.main;
  const tree = syntaxTree(state);

  const push = (from: number, to: number, deco: Decoration, isLine = false) => {
    if (to >= from) items.push({ from, to, deco, isLine });
  };

  // Frontmatter block at document start: dim, mono, smaller.
  const firstLine = state.doc.line(1);
  if (FRONTMATTER_LINE_RE.test(firstLine.text)) {
    push(
      firstLine.from,
      firstLine.from,
      Decoration.line({ class: "cm-ew-frontmatter" }),
      true,
    );
    for (let n = 2; n <= state.doc.lines; n += 1) {
      const line = state.doc.line(n);
      const isClose = FRONTMATTER_LINE_RE.test(line.text);
      push(
        line.from,
        line.from,
        Decoration.line({ class: "cm-ew-frontmatter" }),
        true,
      );
      if (isClose) break;
    }
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const { name, from: nf, to: nt } = node;

        const markClass = NODE_CLASSES[name];
        if (markClass) {
          push(nf, nt, Decoration.mark({ class: markClass }));
          return;
        }

        const headingClass = HEADING_CLASSES[name];
        if (headingClass) {
          const line = state.doc.lineAt(nf);
          push(
            line.from,
            line.from,
            Decoration.line({ class: headingClass }),
            true,
          );
          return;
        }

        if (
          name === "Blockquote" ||
          name === "FencedCode" ||
          name === "CodeBlock"
        ) {
          const cls = name === "Blockquote" ? "cm-ew-quote" : "cm-ew-codeblock";
          const startLine = state.doc.lineAt(nf);
          const endLine = state.doc.lineAt(Math.min(nt, state.doc.length));
          for (let pos = startLine.from; pos <= endLine.from;) {
            const line = state.doc.lineAt(pos);
            push(line.from, line.from, Decoration.line({ class: cls }), true);
            pos = line.to + 1;
          }
          return;
        }

        if (name === "HorizontalRule") {
          const line = state.doc.lineAt(nf);
          push(
            line.from,
            line.from,
            Decoration.line({ class: "cm-ew-hr" }),
            true,
          );
          return;
        }

        if (MARK_NODES.has(name)) {
          // Show the raw mark only when the cursor is inside its construct.
          const parent = node.node.parent;
          const from2 = parent ? parent.from : nf;
          const to2 = parent ? parent.to : nt;
          const cursorInside = sel.from <= to2 && sel.to >= from2;
          push(nf, nt, cursorInside ? markDim : hide);
        }
      },
    });

    // [[wiki-links]], @mentions, %%comments%% — plain-text constructs the
    // markdown parser doesn't know.
    const text = state.doc.sliceString(from, to);
    for (const match of text.matchAll(WIKI_RE)) {
      push(
        from + match.index,
        from + match.index + match[0].length,
        Decoration.mark({ class: "cm-ew-wikilink" }),
      );
    }
    for (const match of text.matchAll(MENTION_RE)) {
      const start = from + match.index + match[1].length;
      push(
        start,
        start + match[0].length - match[1].length,
        Decoration.mark({ class: "cm-ew-mention" }),
      );
    }
    for (const match of text.matchAll(COMMENT_RE)) {
      push(
        from + match.index,
        from + match.index + match[0].length,
        Decoration.mark({ class: "cm-ew-comment" }),
      );
    }
  }

  items.sort(
    (a, b) =>
      a.from - b.from || Number(b.isLine) - Number(a.isLine) || a.to - b.to,
  );
  const builder = new RangeSetBuilder<Decoration>();
  for (const item of items) {
    builder.add(item.from, item.to, item.deco);
  }
  return builder.finish();
}

export function livePreview(): import("@codemirror/state").Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
