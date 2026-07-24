import type { EditorView } from "@codemirror/view";
import { create } from "zustand";

import type { FormatId } from "./format-commands";

/**
 * The live CodeMirror instance, shared with chrome around the editor: the
 * toolbar dispatches commands on it, the outline scrolls it. The editor is
 * the only writer; everyone else is read/run-only.
 */
interface EditorViewState {
  view: EditorView | null;
  /** Toolbar highlight heuristics, refreshed on selection/doc changes. */
  activeFormats: ReadonlySet<FormatId>;
  setView(view: EditorView | null): void;
  setActiveFormats(formats: ReadonlySet<FormatId>): void;
}

export const useEditorViewStore = create<EditorViewState>((set) => ({
  view: null,
  activeFormats: new Set<FormatId>(),
  setView: (view) => set({ view }),
  setActiveFormats: (activeFormats) => set({ activeFormats }),
}));
