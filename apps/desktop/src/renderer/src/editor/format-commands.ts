import { Prec, type ChangeSpec, type EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

/**
 * Formatting commands behind the writer toolbar and its hotkeys (R4).
 * Writers never see the little codes — these wrap/unwrap them around the
 * selection, and every toggle is idempotent: applying it twice is a no-op.
 *
 * Plain functions on the live view, not CM StateCommands, so the toolbar
 * (outside CodeMirror) can run the exact same code as the keymap.
 */

export type FormatId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "numbered"
  | "link";

/** Selected non-blank lines touched by the main selection. */
function selectedLines(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const start = view.state.doc.lineAt(from);
  const end = view.state.doc.lineAt(to);
  const lines = [];
  for (let n = start.number; n <= end.number; n += 1) {
    const line = view.state.doc.line(n);
    if (line.text.trim().length > 0) lines.push(line);
  }
  return lines;
}

/** Toggle `**text**`-style wrapping; with no selection, plant an empty pair. */
function toggleInline(mark: string) {
  return (view: EditorView): boolean => {
    const { state } = view;
    const { from, to } = state.selection.main;

    if (from === to) {
      view.dispatch({
        changes: { from, insert: mark + mark },
        selection: { anchor: from + mark.length },
        userEvent: "input",
      });
      return true;
    }

    // Clamp: CM's sliceString does not tolerate out-of-doc positions.
    const before = state.doc.sliceString(Math.max(0, from - mark.length), from);
    const after = state.doc.sliceString(
      to,
      Math.min(state.doc.length, to + mark.length),
    );
    if (before === mark && after === mark) {
      // Already wearing it — take the marks off (round-trip).
      view.dispatch({
        changes: [
          { from: to, to: to + mark.length },
          { from: from - mark.length, to: from },
        ],
        selection: { anchor: from - mark.length, head: to - mark.length },
        userEvent: "input",
      });
      return true;
    }

    const selected = state.doc.sliceString(from, to);
    if (
      selected.length > mark.length * 2 &&
      selected.startsWith(mark) &&
      selected.endsWith(mark)
    ) {
      // The marks rode along inside the selection — strip just them.
      view.dispatch({
        changes: [
          { from: to - mark.length, to },
          { from, to: from + mark.length },
        ],
        selection: { anchor: from, head: to - mark.length * 2 },
        userEvent: "input",
      });
      return true;
    }

    view.dispatch({
      changes: [
        { from, insert: mark },
        { from: to, insert: mark },
      ],
      selection: { anchor: from + mark.length, head: to + mark.length },
      userEvent: "input",
    });
    return true;
  };
}

/** Toggle a fixed line prefix (`> `, `- `) on every selected line. */
function toggleLinePrefix(prefix: string) {
  return (view: EditorView): boolean => {
    const lines = selectedLines(view);
    if (lines.length === 0) return true;
    const remove = lines.every((line) => line.text.startsWith(prefix));
    const changes: ChangeSpec[] = lines.map((line) =>
      remove
        ? { from: line.from, to: line.from + prefix.length }
        : { from: line.from, insert: prefix },
    );
    view.dispatch({ changes, userEvent: "input" });
    return true;
  };
}

/** Numbered lists renumber from 1 across the selection; toggling strips them. */
function toggleNumbered(view: EditorView): boolean {
  const lines = selectedLines(view);
  if (lines.length === 0) return true;
  const NUMBERED_RE = /^\d+\.\s/;
  const remove = lines.every((line) => NUMBERED_RE.test(line.text));
  const changes: ChangeSpec[] = lines.map((line, index) => {
    if (remove) {
      const match = NUMBERED_RE.exec(line.text)!;
      return { from: line.from, to: line.from + match[0].length };
    }
    // Strip a stale number first so re-applying renumbers cleanly.
    const stale = NUMBERED_RE.exec(line.text);
    return {
      from: line.from,
      to: stale ? line.from + stale[0].length : line.from,
      insert: `${index + 1}. `,
    };
  });
  view.dispatch({ changes, userEvent: "input" });
  return true;
}

const HEADING_RE = /^(#{1,6})\s+/;

/** Headings are a per-line swap: same level again means "back to plain". */
function toggleHeading(level: 1 | 2 | 3) {
  const prefix = `${"#".repeat(level)} `;
  return (view: EditorView): boolean => {
    const lines = selectedLines(view);
    if (lines.length === 0) return true;
    const remove = lines.every((line) => line.text.startsWith(prefix));
    const changes: ChangeSpec[] = [];
    for (const line of lines) {
      const existing = HEADING_RE.exec(line.text);
      if (existing) {
        changes.push(
          remove
            ? { from: line.from, to: line.from + existing[0].length }
            : {
                from: line.from,
                to: line.from + existing[0].length,
                insert: prefix,
              },
        );
      } else if (!remove) {
        changes.push({ from: line.from, insert: prefix });
      }
    }
    view.dispatch({ changes, userEvent: "input" });
    return true;
  };
}

/**
 * Links wrap the selection as `[text](url)` with `url` pre-selected, so the
 * writer types the address immediately; no selection plants `[text](url)`.
 */
function insertLink(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.doc.sliceString(from, to);
  const label = selected.length > 0 ? selected : "text";
  const insert = `[${label}](url)`;
  const urlStart = from + label.length + 3;
  view.dispatch({
    changes: { from, to, insert },
    selection:
      selected.length > 0
        ? { anchor: urlStart, head: urlStart + 3 }
        : { anchor: from + 1, head: from + 1 + label.length },
    userEvent: "input",
  });
  return true;
}

export const formatCommands: Record<FormatId, (view: EditorView) => boolean> = {
  bold: toggleInline("**"),
  italic: toggleInline("*"),
  strikethrough: toggleInline("~~"),
  h1: toggleHeading(1),
  h2: toggleHeading(2),
  h3: toggleHeading(3),
  quote: toggleLinePrefix("> "),
  bullet: toggleLinePrefix("- "),
  numbered: toggleNumbered,
  link: insertLink,
};

/**
 * Prec.high so these win over CM's defaults, but they still sit BELOW the
 * plugin compartment in extension order — a medium plugin that owns a key
 * (screenplay's Tab-cycling) is never fought. None of these keys are Tab.
 */
export const formatKeymap = Prec.high(
  keymap.of([
    { key: "Mod-b", run: formatCommands.bold },
    { key: "Mod-i", run: formatCommands.italic },
    { key: "Mod-k", run: formatCommands.link },
    { key: "Mod-1", run: formatCommands.h1 },
    { key: "Mod-2", run: formatCommands.h2 },
    { key: "Mod-3", run: formatCommands.h3 },
  ]),
);

/** Odd count of `mark` before `pos` on its line ≈ the cursor sits inside. */
function insideMark(state: EditorState, mark: string): boolean {
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const before = line.text.slice(0, head - line.from);
  const count = before.split(mark).length - 1;
  return count % 2 === 1;
}

/**
 * Cheap active-format heuristics for toolbar highlighting — deliberately NOT
 * a syntax-tree walk; a wrong highlight for one keystroke costs nothing.
 */
export function activeFormatsAt(state: EditorState): Set<FormatId> {
  const active = new Set<FormatId>();
  const { from, to } = state.selection.main;

  const wrapped = (mark: string) =>
    from !== to &&
    state.doc.sliceString(Math.max(0, from - mark.length), from) === mark &&
    state.doc.sliceString(to, Math.min(state.doc.length, to + mark.length)) ===
      mark;

  if (wrapped("**") || (from === to && insideMark(state, "**"))) {
    active.add("bold");
  }
  // Italic: a single `*` hug — bold's `**` already claimed the pair case.
  if (
    !active.has("bold") &&
    (wrapped("*") || (from === to && insideMark(state, "*")))
  ) {
    active.add("italic");
  }
  if (wrapped("~~") || (from === to && insideMark(state, "~~"))) {
    active.add("strikethrough");
  }

  const lines: { text: string }[] = [];
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  for (let n = startLine.number; n <= endLine.number; n += 1) {
    const line = state.doc.line(n);
    if (line.text.trim().length > 0) lines.push(line);
  }
  if (lines.length > 0) {
    const heading = HEADING_RE.exec(lines[0].text);
    if (heading && lines.every((l) => l.text.startsWith(heading[0]))) {
      const level = heading[1].length;
      if (level === 1) active.add("h1");
      if (level === 2) active.add("h2");
      if (level === 3) active.add("h3");
    }
    if (lines.every((l) => l.text.startsWith("> "))) active.add("quote");
    if (lines.every((l) => l.text.startsWith("- "))) active.add("bullet");
    if (lines.every((l) => /^\d+\.\s/.test(l.text))) active.add("numbered");
  }

  // Link: cursor inside a `[label](url)` span on its line.
  const line = state.doc.lineAt(state.selection.main.head);
  const offset = state.selection.main.head - line.from;
  for (const match of line.text.matchAll(/\[[^\]]*\]\([^)]*\)/g)) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      active.add("link");
      break;
    }
  }

  return active;
}
