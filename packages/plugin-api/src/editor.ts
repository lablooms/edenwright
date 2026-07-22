import type { Extension } from "@codemirror/state";

import type { Disposable } from "./disposable.js";

/**
 * Editor extension points (SPEC v2 §7.2). Edenwright's editor is CodeMirror
 * 6; plugins contribute real CM6 extensions. Medium plugins (screenplay
 * mode, comic rail) use this hook and gate by the open file's preset medium.
 */
export interface EditorRegistry {
  /**
   * Register a CM6 extension applied to every editor. Medium plugins scope
   * theirs by checking the open document's preset/medium in the extension.
   */
  registerExtension(extension: Extension): Disposable;
}
