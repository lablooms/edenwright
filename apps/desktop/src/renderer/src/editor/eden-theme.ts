import { EditorView } from "@codemirror/view";

/**
 * The CodeMirror skin of SPEC §3 — every color a token, editor font Literata,
 * leaf for caret/selection/links. No hex anywhere (golden rule 4).
 */
export function edenTheme(): import("@codemirror/state").Extension {
  return EditorView.theme({
    "&": {
      backgroundColor: "var(--ew-void)",
      color: "var(--ew-ink)",
      height: "100%",
      fontSize: "17px",
    },
    ".cm-content": {
      lineHeight: "1.7",
      padding:
        "var(--ew-space-6) max(var(--ew-space-8), calc((100% - 72ch) / 2))",
      caretColor: "var(--ew-leaf)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-cursor": { borderLeftColor: "var(--ew-leaf)" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--ew-selection)",
    },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-gutters": { display: "none" },

    ".cm-ew-strong": { fontWeight: "700" },
    ".cm-ew-em": { fontStyle: "italic" },
    ".cm-ew-strike": { textDecoration: "line-through" },
    ".cm-ew-inline-code": {
      fontFamily: "var(--ew-font-mono)",
      fontSize: "0.86em",
      backgroundColor: "var(--ew-accent-tint)",
      borderRadius: "4px",
      padding: "0 3px",
    },
    ".cm-ew-url": { color: "var(--ew-ink-dim)" },
    ".cm-ew-h1": { fontSize: "1.6em", fontWeight: "600", lineHeight: "1.35" },
    ".cm-ew-h2": { fontSize: "1.4em", fontWeight: "600", lineHeight: "1.4" },
    ".cm-ew-h3": { fontSize: "1.2em", fontWeight: "600" },
    ".cm-ew-h4, .cm-ew-h5, .cm-ew-h6": { fontWeight: "600" },
    ".cm-ew-quote": {
      boxShadow: "inset 3px 0 0 var(--ew-leaf-deep)",
      paddingLeft: "12px",
      color: "var(--ew-ink-dim)",
    },
    ".cm-ew-codeblock": {
      fontFamily: "var(--ew-font-mono)",
      fontSize: "0.88em",
      backgroundColor: "var(--ew-surface-raised)",
    },
    ".cm-ew-hr": { color: "var(--ew-leaf-deep)", letterSpacing: "0.3em" },
    ".cm-ew-frontmatter": {
      fontFamily: "var(--ew-font-mono)",
      fontSize: "0.8em",
      color: "var(--ew-ink-dim)",
    },
    ".cm-ew-mark-dim": { opacity: "0.45" },
    ".cm-ew-wikilink": {
      color: "var(--ew-leaf)",
      textDecoration: "underline",
      textDecorationColor: "var(--ew-leaf-deep)",
      textUnderlineOffset: "3px",
      cursor: "pointer",
    },
    ".cm-ew-mention": {
      color: "var(--ew-leaf-bright)",
      backgroundColor: "var(--ew-accent-tint)",
      borderRadius: "4px",
      padding: "0 2px",
    },
    ".cm-ew-comment": {
      color: "var(--ew-ink-dim)",
      fontStyle: "italic",
      opacity: "0.7",
    },
    ".cm-ew-focus-dim": { opacity: "0.32" },

    // Panels (find & replace) and tooltips (autocomplete).
    ".cm-panels": {
      backgroundColor: "var(--ew-surface-raised)",
      color: "var(--ew-ink)",
      borderColor: "var(--ew-border)",
    },
    ".cm-panel.cm-search": { fontFamily: "var(--ew-font-ui)" },
    ".cm-panel.cm-search input, .cm-panel.cm-search button": {
      fontFamily: "var(--ew-font-ui)",
      color: "var(--ew-ink)",
      backgroundColor: "var(--ew-void)",
      border: "1px solid var(--ew-border)",
      borderRadius: "var(--ew-radius-sm)",
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--ew-accent-tint)",
      outline: "1px solid var(--ew-leaf-deep)",
    },
    ".cm-searchMatch-selected": { backgroundColor: "var(--ew-selection)" },
    ".cm-tooltip": {
      backgroundColor: "var(--ew-surface-raised)",
      border: "1px solid var(--ew-border)",
      borderRadius: "var(--ew-radius-sm)",
      color: "var(--ew-ink)",
      fontFamily: "var(--ew-font-ui)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--ew-accent-tint)",
      color: "var(--ew-ink)",
    },
    ".cm-completionDetail": { color: "var(--ew-ink-dim)", fontStyle: "normal" },
  });
}
