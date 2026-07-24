import { EditorView } from "@codemirror/view";

/**
 * Typewriter mode (R4): the line being written stays vertically centered.
 * Two cheap parts — padding lets the scroller go past the document end so
 * the LAST lines can center too, and a listener re-centers on caret moves.
 * (scrollIntoView dispatches no state change, so this can't loop.)
 */

const pastEndPadding = EditorView.theme({
  ".cm-content": { paddingBottom: "50vh" },
});

const centerOnCaret = EditorView.updateListener.of((update) => {
  if (!update.selectionSet && !update.docChanged) return;
  const head = update.state.selection.main.head;
  update.view.dispatch({
    effects: EditorView.scrollIntoView(head, { y: "center" }),
  });
});

export function typewriterMode(): import("@codemirror/state").Extension[] {
  return [pastEndPadding, centerOnCaret];
}
