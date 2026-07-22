import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Focus mode (SPEC §7.2): the current paragraph stays lit while the rest of
 * the manuscript dims, and typewriter scrolling keeps the caret vertically
 * centered.
 */

function buildFocusDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const sel = state.selection.main;
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      const active = sel.from <= line.to && sel.to >= line.from;
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: active ? "cm-ew-focus-active" : "cm-ew-focus-dim",
        }),
      );
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const focusLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFocusDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildFocusDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const typewriterScroll = EditorView.updateListener.of((update) => {
  if (!update.selectionSet && !update.docChanged) return;
  const head = update.state.selection.main.head;
  // scrollIntoView does not change state, so no update loop.
  update.view.dispatch({
    effects: EditorView.scrollIntoView(head, { y: "center" }),
  });
});

export function focusModeExtensions(): import("@codemirror/state").Extension[] {
  return [focusLines, typewriterScroll];
}
