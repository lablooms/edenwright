import { EditorView } from "@codemirror/view";

const WIKI_AT_RE = /\[\[([^\][|]+)(?:\|[^\]]*)?\]\]/g;
const MENTION_AT_RE = /(^|[^\p{L}\p{N}@_])@([\p{L}][\p{L}\p{N}_-]*)/gu;

/**
 * Ctrl/Cmd-click on a [[wiki-link]] or @mention opens the target (§7.3/§7.4).
 * Resolution goes through the index-backed bridge; callers decide what
 * "open" means for files vs. entities.
 */
export function linkNavigation(handlers: {
  onOpenWikiLink: (rawTarget: string) => void;
  onOpenMention: (entityKey: string) => void;
}): import("@codemirror/state").Extension {
  return EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const line = view.state.doc.lineAt(pos);
      const lineStart = line.from;
      const text = line.text;

      for (const match of text.matchAll(WIKI_AT_RE)) {
        const start = lineStart + match.index;
        const end = start + match[0].length;
        if (pos >= start && pos <= end) {
          handlers.onOpenWikiLink(match[1].trim());
          event.preventDefault();
          return true;
        }
      }

      for (const match of text.matchAll(MENTION_AT_RE)) {
        const start = lineStart + match.index + match[1].length;
        const end = start + match[2].length + 1;
        if (pos >= start && pos <= end) {
          handlers.onOpenMention(match[2].toLowerCase());
          event.preventDefault();
          return true;
        }
      }

      return false;
    },
  });
}
