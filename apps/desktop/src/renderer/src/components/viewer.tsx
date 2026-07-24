import { useDeferredValue, useMemo } from "react";

import { countWords, kindFromPath } from "@edenwright/core";
import { CalendarClock, Download, FileText, LayoutGrid } from "lucide-react";

import { Button, EmptyState, Icon } from "@edenwright/ui";

import { useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { CodexSheet } from "./codex-sheet";
import { EditorToolbar } from "./editor-toolbar";
import { MarkdownEditor } from "./markdown-editor";
import "./viewer.css";

/**
 * The M2 editor surface: CodeMirror 6 live-preview markdown with focus mode,
 * completions, and find & replace (SPEC §7.1–7.3).
 */
export function Viewer() {
  const openFile = useAppStore((state) => state.openFile);
  const focusMode = useAppStore((state) => state.focusMode);
  const focusStartWords = useAppStore((state) => state.focusStartWords);
  const smartQuotes = useAppStore(
    (state) =>
      state.edenState?.current?.settings.editor.smartTypography ?? true,
  );
  const fontFamily = useAppStore(
    (state) =>
      state.edenState?.current?.settings.editor.fontFamily ?? "literata",
  );
  const fontSize = useAppStore(
    (state) => state.edenState?.current?.settings.editor.fontSize ?? 17,
  );
  const lineWidth = useAppStore(
    (state) => state.edenState?.current?.settings.editor.lineWidth ?? 72,
  );
  const typewriterMode = useAppStore(
    (state) =>
      state.edenState?.current?.settings.editor.typewriterMode ?? false,
  );
  const registeredExtensions = usePluginStore(
    (state) => state.editorExtensions,
  );
  const edenManifest = useAppStore((state) => state.edenManifest);
  const editSource = useAppStore((state) => state.editSource);
  const setMainView = useAppStore((state) => state.setMainView);
  const setExportOpen = useAppStore((state) => state.setExportOpen);

  // Factories are computed per editor with the eden's preset/medium —
  // that's how medium plugins gate themselves (SPEC v2 §7.2).
  const pluginExtensions = useMemo(() => {
    if (!openFile) return [];
    const context = {
      filePath: openFile.path,
      medium: edenManifest?.medium ?? null,
      preset: edenManifest?.preset ?? null,
    };
    return registeredExtensions
      .map((extension) =>
        typeof extension === "function" ? extension(context) : extension,
      )
      .filter((extension) => extension !== null);
  }, [openFile, edenManifest, registeredExtensions]);

  const reveal = useAppStore((state) => state.reveal);
  const setDraft = useAppStore((state) => state.setDraft);
  const saveFile = useAppStore((state) => state.saveFile);
  const setReveal = useAppStore((state) => state.setReveal);
  const openWikiLink = useAppStore((state) => state.openWikiLink);
  const openMention = useAppStore((state) => state.openMention);

  const deferredContent = useDeferredValue(openFile?.content ?? "");
  const words = useMemo(() => countWords(deferredContent), [deferredContent]);

  if (!openFile) {
    return (
      <EmptyState
        icon={<Icon icon={FileText} size={40} strokeWidth={1.2} />}
        title="Pick a file from the tree."
        body="Everything here is a plain file on your disk — open one and start writing."
        hint="Ctrl/Cmd-P jumps to anything by name."
      />
    );
  }

  const dirty = openFile.content !== openFile.savedContent;
  const fileName = openFile.path.slice(openFile.path.lastIndexOf("/") + 1);
  const sessionDelta =
    focusStartWords !== null ? words - focusStartWords : null;
  const isCodexFile = kindFromPath(openFile.path) === "codex" && !editSource;
  // The toolbar formats prose files; anything else gets it greyed out.
  const isMarkdown = openFile.path.toLowerCase().endsWith(".md");

  return (
    <div className="viewer">
      {isCodexFile ? null : (
        <header className="viewer__header">
          <div className="viewer__title-block">
            <h2 className="viewer__title">
              {fileName}
              {dirty ? (
                <span className="viewer__dirty-dot" title="Unsaved" />
              ) : null}
            </h2>
            <span className="viewer__path">{openFile.path}</span>
          </div>
          <div className="viewer__meta">
            {sessionDelta !== null ? (
              <span
                className="viewer__session"
                title="Words this focus session"
              >
                {sessionDelta >= 0 ? "+" : ""}
                {sessionDelta.toLocaleString()}
              </span>
            ) : null}
            <span className="viewer__words">
              {words.toLocaleString()} words
            </span>
            <Button
              variant="ghost"
              title="Timeline"
              onClick={() => setMainView("timeline")}
            >
              <Icon icon={CalendarClock} size={15} />
            </Button>
            <Button
              variant="ghost"
              title="Corkboard"
              onClick={() => setMainView("corkboard")}
            >
              <Icon icon={LayoutGrid} size={15} />
            </Button>
            <Button
              variant="ghost"
              title="Export…"
              onClick={() => setExportOpen(true)}
            >
              <Icon icon={Download} size={15} />
            </Button>
            <Button
              variant={dirty ? "primary" : "ghost"}
              disabled={!dirty || openFile.saving}
              onClick={() => void saveFile()}
            >
              {openFile.saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </header>
      )}
      {isCodexFile ? (
        <CodexSheet key={openFile.path} />
      ) : (
        <>
          {focusMode ? null : <EditorToolbar disabled={!isMarkdown} />}
          <MarkdownEditor
            key={openFile.path}
            initialContent={openFile.content}
            content={openFile.content}
            savedContent={openFile.savedContent}
            focusMode={focusMode}
            smartQuotes={smartQuotes}
            fontFamily={fontFamily}
            fontSize={fontSize}
            lineWidth={lineWidth}
            typewriterMode={typewriterMode}
            pluginExtensions={pluginExtensions}
            revealTerm={
              reveal && reveal.path === openFile.path ? reveal.term : null
            }
            onChange={setDraft}
            onSave={() => void saveFile()}
            onOpenWikiLink={(raw) => void openWikiLink(raw)}
            onOpenMention={(key) => void openMention(key)}
            onRevealDone={() => setReveal(null)}
          />
        </>
      )}
    </div>
  );
}
