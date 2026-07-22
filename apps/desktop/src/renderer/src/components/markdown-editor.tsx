import { useEffect, useRef } from "react";

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
import { focusModeExtensions } from "../editor/focus-mode";
import { linkNavigation } from "../editor/link-navigation";
import { livePreview } from "../editor/live-preview";
import { smartTypography } from "../editor/smart-typography";
import "./markdown-editor.css";

/** Bundled font ids (SPEC §3.2) → token stacks; anything else is a system font. */
const FONT_STACKS: Record<string, string> = {
  literata: "var(--ew-font-editor)",
  "space-grotesk": "var(--ew-font-ui)",
  "jetbrains-mono": "var(--ew-font-mono)",
  "courier-prime": "var(--ew-font-screenplay)",
};

function fontTheme(
  fontFamily: string,
  fontSize: number,
): import("@codemirror/state").Extension {
  const family =
    FONT_STACKS[fontFamily] ?? `"${fontFamily}", var(--ew-font-editor)`;
  return EditorView.theme({
    ".cm-content, .cm-scroller": { fontFamily: family },
    ".cm-content": { fontSize: `${fontSize}px` },
  });
}

export interface MarkdownEditorProps {
  /** Eden-relative path of the open file (for project-aware completions). */
  filePath: string;
  initialContent: string;
  /** Content as the store knows it — the doc follows it on reloads. */
  content: string;
  /** Latest disk/saved content; changes signal a reload to adopt. */
  savedContent: string;
  focusMode: boolean;
  smartQuotes: boolean;
  fontFamily: string;
  fontSize: number;
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
  filePath,
  initialContent,
  content,
  savedContent,
  focusMode,
  smartQuotes,
  fontFamily,
  fontSize,
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
              mentionCompletion(() => {
                // Project-aware entities: own codex + linked worlds' (§7.5).
                const segments = filePath.split("/");
                if (segments[0] === "Projects" && segments[1]) {
                  return window.edenwright.entities.forProject(segments[1]);
                }
                return window.edenwright.query.entities();
              }),
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
          fontCompartment.current.of(fontTheme(fontFamily, fontSize)),
          focusCompartment.current.of(focusMode ? focusModeExtensions() : []),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const doc = update.state.doc.toString();
            callbacksRef.current.onChange(doc);
            dirtyRef.current = doc !== savedRef.current;
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
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
      effects: fontCompartment.current.reconfigure(
        fontTheme(fontFamily, fontSize),
      ),
    });
  }, [fontFamily, fontSize]);

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

  return <div className="markdown-editor" ref={containerRef} />;
}
