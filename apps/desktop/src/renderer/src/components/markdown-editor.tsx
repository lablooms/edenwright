import { useEffect, useRef, type CSSProperties } from "react";

import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import { mentionCompletion, wikiLinkCompletion } from "../editor/completions";
import { edenTheme } from "../editor/eden-theme";
import { useEditorViewStore } from "../editor/editor-view-store";
import { focusModeExtensions } from "../editor/focus-mode";
import { activeFormatsAt, formatKeymap } from "../editor/format-commands";
import { linkNavigation } from "../editor/link-navigation";
import { livePreview } from "../editor/live-preview";
import { smartTypography } from "../editor/smart-typography";
import { typewriterMode } from "../editor/typewriter-mode";
import "./markdown-editor.css";

/** Bundled font ids (SPEC §3.2) → token stacks; anything else is a system font. */
const FONT_STACKS: Record<string, string> = {
  literata: "var(--ew-font-editor)",
  "space-grotesk": "var(--ew-font-ui)",
  "jetbrains-mono": "var(--ew-font-mono)",
  "courier-prime": "var(--ew-font-screenplay)",
};

function fontTheme(fontFamily: string): import("@codemirror/state").Extension {
  const family =
    FONT_STACKS[fontFamily] ?? `"${fontFamily}", var(--ew-font-editor)`;
  // Font SIZE is a CSS var (see eden-theme) — only the family needs CM.
  return EditorView.theme({
    ".cm-content, .cm-scroller": { fontFamily: family },
  });
}

export interface MarkdownEditorProps {
  initialContent: string;
  /** Content as the store knows it — the doc follows it on reloads. */
  content: string;
  /** Latest disk/saved content; changes signal a reload to adopt. */
  savedContent: string;
  focusMode: boolean;
  smartQuotes: boolean;
  fontFamily: string;
  fontSize: number;
  /** Editor line length in ch (the settings "line width" slider). */
  lineWidth: number;
  typewriterMode: boolean;
  /** CM extensions contributed by plugins (SPEC v2 §7.2) — medium modes ride
   * this slot, so their keymaps outrank the defaults (as engine modes did). */
  pluginExtensions: import("@codemirror/state").Extension[];
  /** Term to select + center once (after opening from search). */
  revealTerm: string | null;
  onChange(doc: string): void;
  onSave(): void;
  onOpenWikiLink(raw: string): void;
  onOpenMention(key: string): void;
  onRevealDone(): void;
}

/**
 * The M2 editor: CodeMirror 6 with live-preview markdown (SPEC §7.1).
 * One instance per file — the parent keys this component by path.
 */
export function MarkdownEditor({
  initialContent,
  content,
  savedContent,
  focusMode,
  smartQuotes,
  fontFamily,
  fontSize,
  lineWidth,
  typewriterMode: typewriter,
  pluginExtensions,
  revealTerm,
  onChange,
  onSave,
  onOpenWikiLink,
  onOpenMention,
  onRevealDone,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const focusCompartment = useRef(new Compartment());
  const typographyCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const typewriterCompartment = useRef(new Compartment());
  const pluginCompartment = useRef(new Compartment());
  const savedRef = useRef(savedContent);
  const dirtyRef = useRef(false);

  // Stable refs for callbacks used inside the CM closures.
  const callbacksRef = useRef({
    onChange,
    onSave,
    onOpenWikiLink,
    onOpenMention,
    onRevealDone,
  });
  callbacksRef.current = {
    onChange,
    onSave,
    onOpenWikiLink,
    onOpenMention,
    onRevealDone,
  };
  savedRef.current = savedContent;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          history(),
          search({ top: true }),
          highlightSelectionMatches(),
          markdown({ base: markdownLanguage }),
          autocompletion({
            override: [
              wikiLinkCompletion(() => window.edenwright.query.files()),
              // One eden, one codex: @ completes every entity in it.
              mentionCompletion(() => window.edenwright.query.entities()),
            ],
            activateOnTyping: true,
          }),
          livePreview(),
          edenTheme(),
          linkNavigation({
            onOpenWikiLink: (raw) => callbacksRef.current.onOpenWikiLink(raw),
            onOpenMention: (key) => callbacksRef.current.onOpenMention(key),
          }),
          EditorView.lineWrapping,
          // Plugin keymaps (e.g. screenplay Tab-cycling) must outrank
          // everything below (CM keymap precedence: earlier wins).
          pluginCompartment.current.of(pluginExtensions),
          // The writer toolbar's hotkeys: above CM defaults, below plugins.
          formatKeymap,
          // Writers hit Tab to indent — never to escape the editor (§11).
          keymap.of([indentWithTab]),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                callbacksRef.current.onSave();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          // Brackets pair; quotes do NOT auto-close — smart typography
          // below curls them instead, which is what a writer wants.
          markdownLanguage.data.of({
            closeBrackets: { brackets: ["(", "[", "{"] },
          }),
          closeBrackets(),
          typographyCompartment.current.of(
            smartQuotes ? smartTypography() : [],
          ),
          fontCompartment.current.of(fontTheme(fontFamily)),
          typewriterCompartment.current.of(typewriter ? typewriterMode() : []),
          focusCompartment.current.of(focusMode ? focusModeExtensions() : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const doc = update.state.doc.toString();
              callbacksRef.current.onChange(doc);
              dirtyRef.current = doc !== savedRef.current;
            }
            if (update.docChanged || update.selectionSet) {
              // Toolbar highlight follows the caret.
              useEditorViewStore
                .getState()
                .setActiveFormats(activeFormatsAt(update.state));
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    // Chrome around the editor (toolbar, outline) reaches the view here.
    useEditorViewStore.getState().setView(view);
    useEditorViewStore.getState().setActiveFormats(activeFormatsAt(view.state));

    return () => {
      useEditorViewStore.getState().setView(null);
      useEditorViewStore.getState().setActiveFormats(new Set());
      view.destroy();
      viewRef.current = null;
    };
    // One editor per mount — the parent keys this component by file path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus mode toggling reconfigures its compartment.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: focusCompartment.current.reconfigure(
        focusMode ? focusModeExtensions() : [],
      ),
    });
  }, [focusMode]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: typographyCompartment.current.reconfigure(
        smartQuotes ? smartTypography() : [],
      ),
    });
  }, [smartQuotes]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: fontCompartment.current.reconfigure(fontTheme(fontFamily)),
    });
  }, [fontFamily]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: typewriterCompartment.current.reconfigure(
        typewriter ? typewriterMode() : [],
      ),
    });
  }, [typewriter]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: pluginCompartment.current.reconfigure(pluginExtensions),
    });
  }, [pluginExtensions]);

  // A savedContent change means the store reloaded (external edit while
  // clean, or a conflict resolution) — adopt the store's content. While the
  // user is dirty the store never reloads, so typing can't be clobbered.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    if (doc !== content) {
      const head = Math.min(view.state.selection.main.head, content.length);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        selection: { anchor: head },
      });
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedContent]);

  // Jump-to-term when arriving from global search.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !revealTerm) return;
    const doc = view.state.doc.toString();
    const index = doc.toLowerCase().indexOf(revealTerm.toLowerCase());
    if (index >= 0) {
      view.dispatch({
        selection: { anchor: index, head: index + revealTerm.length },
        effects: EditorView.scrollIntoView(index, { y: "center" }),
      });
      view.focus();
    }
    callbacksRef.current.onRevealDone();
  }, [revealTerm]);

  // Comfort settings land as CSS vars on the editor root (see eden-theme).
  const comfortVars = {
    "--ew-editor-font-size": `${fontSize}px`,
    "--ew-editor-line-width": `${lineWidth}ch`,
  } as CSSProperties;

  return (
    <div className="markdown-editor" ref={containerRef} style={comfortVars} />
  );
}
