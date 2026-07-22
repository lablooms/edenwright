import { useEffect, useMemo, useRef, useState } from "react";

import { countWords } from "@edenwright/core";

import { useAppStore } from "../store";
import { useChromeStore } from "../chrome-store";
import { usePluginStore } from "../plugins/plugin-store";
import { fuzzyScore } from "../lib/fuzzy";
import "./palette.css";

interface PaletteEntry {
  id: string;
  section: "Files" | "Entities" | "Commands";
  label: string;
  detail?: string;
  run: () => void;
}

const SECTION_ORDER: PaletteEntry["section"][] = [
  "Files",
  "Entities",
  "Commands",
];

/** Ctrl/Cmd-P: files, entities, and commands in one switcher (§7.3). */
export function Palette() {
  const paletteOpen = useAppStore((state) => state.paletteOpen);
  const setPaletteOpen = useAppStore((state) => state.setPaletteOpen);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const openFile = useAppStore((state) => state.openFile);
  const closeFile = useAppStore((state) => state.closeFile);
  const saveFile = useAppStore((state) => state.saveFile);
  const closeEden = useAppStore((state) => state.closeEden);
  const bumpSearchFocus = useAppStore((state) => state.bumpSearchFocus);
  const toggleFocusMode = useAppStore((state) => state.toggleFocusMode);
  const togglePanel = useChromeStore((state) => state.togglePanel);
  const pluginCommands = usePluginStore((state) => state.commands);

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PaletteEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery("");
    setSelected(0);

    const commands: PaletteEntry[] = [
      {
        id: "cmd:save",
        section: "Commands",
        label: "Save file",
        detail: "Ctrl/Cmd-S",
        run: () => void saveFile(),
      },
      {
        id: "cmd:close-file",
        section: "Commands",
        label: "Close file",
        run: () => closeFile(),
      },
      {
        id: "cmd:focus",
        section: "Commands",
        label: "Toggle focus mode",
        detail: "Ctrl/Cmd-Shift-Enter",
        run: () => {
          toggleFocusMode(openFile ? countWords(openFile.content) : 0);
        },
      },
      {
        id: "cmd:search",
        section: "Commands",
        label: "Global search",
        detail: "Ctrl/Cmd-Shift-F",
        run: () => bumpSearchFocus(),
      },
      {
        id: "cmd:new-project",
        section: "Commands",
        label: "New project…",
        run: () => useAppStore.getState().setNewProjectOpen(true),
      },
      {
        id: "cmd:export",
        section: "Commands",
        label: "Export project…",
        run: () => useAppStore.getState().setExportOpen(true),
      },
      {
        id: "cmd:panel",
        section: "Commands",
        label: "Toggle right panel",
        run: () => togglePanel(),
      },
      {
        id: "cmd:switch",
        section: "Commands",
        label: "Switch eden",
        run: () => void closeEden(),
      },
    ];

    let cancelled = false;
    void Promise.all([
      window.edenwright.query.files(),
      window.edenwright.query.entities(),
    ]).then(([files, entities]) => {
      if (cancelled) return;
      setEntries([
        ...files.map((file) => ({
          id: `file:${file.path}`,
          section: "Files" as const,
          label: file.title,
          detail: file.path,
          run: () => void openFileAt(file.path),
        })),
        ...entities.map((entity) => ({
          id: `entity:${entity.path}`,
          section: "Entities" as const,
          label: entity.name,
          detail: entity.entityType ?? entity.path,
          run: () => void openFileAt(entity.path),
        })),
        ...commands,
        ...pluginCommands.map((command) => ({
          id: `plugin:${command.id}`,
          section: "Commands" as const,
          label: command.name,
          detail: command.hotkey ?? "Plugin",
          run: () => command.callback(),
        })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [
    paletteOpen,
    openFileAt,
    closeFile,
    saveFile,
    closeEden,
    bumpSearchFocus,
    toggleFocusMode,
    togglePanel,
    openFile,
    pluginCommands,
  ]);

  const filtered = useMemo(() => {
    const scored = entries
      .map((entry) => ({
        entry,
        score: query
          ? Math.max(
              fuzzyScore(query, entry.label) ?? -1,
              entry.detail ? (fuzzyScore(query, entry.detail) ?? -1) : -1,
            )
          : 0,
      }))
      .filter((item) => item.score !== -1);
    scored.sort((a, b) => {
      const sectionDelta =
        SECTION_ORDER.indexOf(a.entry.section) -
        SECTION_ORDER.indexOf(b.entry.section);
      if (query) {
        return b.score! - a.score! || sectionDelta;
      }
      return sectionDelta;
    });
    return scored.map((item) => item.entry).slice(0, 60);
  }, [entries, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const row = listRef.current?.querySelector(`[data-index="${selected}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!paletteOpen) return null;

  const runEntry = (entry: PaletteEntry) => {
    setPaletteOpen(false);
    entry.run();
  };

  let lastSection: string | null = null;
  let flatIndex = -1;

  return (
    <div
      className="palette-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPaletteOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-label="Quick switcher">
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Jump to a file, entity, or command…"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelected((value) => Math.min(value + 1, filtered.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelected((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const entry = filtered[selected];
              if (entry) runEntry(entry);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setPaletteOpen(false);
            }
          }}
        />
        <div className="palette__list" ref={listRef}>
          {filtered.length === 0 ? (
            <p className="palette__empty">Nothing by that name grows here.</p>
          ) : (
            filtered.map((entry) => {
              flatIndex += 1;
              const index = flatIndex;
              const header =
                entry.section !== lastSection ? entry.section : null;
              lastSection = entry.section;
              return (
                <div key={entry.id}>
                  {header ? (
                    <div className="palette__section">{header}</div>
                  ) : null}
                  <button
                    type="button"
                    data-index={index}
                    className="palette__row"
                    data-selected={index === selected || undefined}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => runEntry(entry)}
                  >
                    <span className="palette__label">{entry.label}</span>
                    {entry.detail ? (
                      <span className="palette__detail">{entry.detail}</span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
