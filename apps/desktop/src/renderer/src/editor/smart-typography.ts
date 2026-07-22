import { EditorView } from "@codemirror/view";

/**
 * Smart typography (SPEC §7.1): straight quotes curl, `--` becomes an
 * em-dash, `...` becomes an ellipsis — as you type, no menu anywhere.
 */

const OPENERS = new Set([
  "",
  " ",
  "\n",
  "\t",
  "(",
  "[",
  "{",
  "—",
  "–",
  "-",
  "“",
  "‘",
]);

function replaceLast(
  view: EditorView,
  from: number,
  count: number,
  insert: string,
): boolean {
  view.dispatch({
    changes: { from: from - count, to: from, insert },
    selection: { anchor: from - count + insert.length },
    userEvent: "input.type",
  });
  return true;
}

export function smartTypography(): import("@codemirror/state").Extension {
  return EditorView.inputHandler.of((view, from, _to, text) => {
    const doc = view.state.doc;

    if (text === "-" && from >= 1 && doc.sliceString(from - 1, from) === "-") {
      return replaceLast(view, from, 1, "—");
    }

    if (text === "." && from >= 2 && doc.sliceString(from - 2, from) === "..") {
      return replaceLast(view, from, 2, "…");
    }

    if (text === '"') {
      const prev = from > 0 ? doc.sliceString(from - 1, from) : "";
      const open = OPENERS.has(prev);
      view.dispatch({
        changes: { from, to: from, insert: open ? "“" : "”" },
        selection: { anchor: from + 1 },
        userEvent: "input.type",
      });
      return true;
    }

    if (text === "'") {
      const prev = from > 0 ? doc.sliceString(from - 1, from) : "";
      // After a letter it's an apostrophe or a closing quote — always ’.
      const open = OPENERS.has(prev);
      view.dispatch({
        changes: { from, to: from, insert: open ? "‘" : "’" },
        selection: { anchor: from + 1 },
        userEvent: "input.type",
      });
      return true;
    }

    return false;
  });
}
