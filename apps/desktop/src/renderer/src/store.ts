import { countWords } from "@edenwright/core";
import type { ModalOptions } from "@edenwright/plugin-api";
import { create } from "zustand";

import type {
  CreateEdenInput,
  EdenEventPayload,
  EdenManifestInfo,
  EdenStateInfo,
  TreeNode,
} from "../../preload/api";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "warn";
}

export interface OpenFile {
  path: string;
  content: string;
  savedContent: string;
  mtimeMs: number;
  saving: boolean;
}

let toastSeq = 0;
/**
 * Monotonic guard for refreshTree: watcher events, eden-opened, and UI
 * actions all trigger refreshes that race over IPC. Only the newest response
 * may land — a stale one would flap rows back into existence mid-click.
 */
let treeRefreshSeq = 0;

/** Strip Electron's IPC wrapper so users see our message, not the plumbing. */
export function ipcErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );
}

interface AppState {
  /** null until the first state fetch resolves. */
  edenState: EdenStateInfo | null;
  /** eden.json of the open eden — goals, order, preset, medium. */
  edenManifest: EdenManifestInfo | null;
  /** Last failed open's message — the launcher shows it inline. */
  edenOpenError: string | null;
  tree: TreeNode[];
  openFile: OpenFile | null;
  expanded: Set<string>;
  /** Directory new files/folders grow in (last tree-dir click wins). */
  creationDir: string | null;
  toasts: Toast[];
  indexing: { done: number; total: number } | null;
  sideView: "files" | "search" | "world" | "themes";
  paletteOpen: boolean;
  /** Incremented to (re)focus the search input. */
  searchFocusSeq: number;
  focusMode: boolean;
  focusStartWords: number | null;
  reveal: { path: string; term: string } | null;
  settingsOpen: boolean;
  settingsInitialTab: string | null;
  exportOpen: boolean;
  /** Codex sheets open in source (raw markdown) mode when true. */
  editSource: boolean;
  /** What the main area shows; opening a file returns to the editor. */
  mainView: "editor" | "timeline" | "corkboard";
  modalRequest: {
    options: ModalOptions;
    resolve: (choice: string | null) => void;
  } | null;

  init(): Promise<void>;
  toast(message: string, kind?: Toast["kind"]): void;
  dismissToast(id: number): void;

  refreshTree(): Promise<void>;
  createEden(
    parentDir: string,
    name: string,
    input: CreateEdenInput,
  ): Promise<boolean>;
  openEden(path: string): Promise<boolean>;
  closeEden(): Promise<void>;
  /** Forget a recents entry; the eden's files stay on disk. */
  removeRecentEden(path: string): Promise<void>;

  openFileAt(path: string): Promise<void>;
  closeFile(): void;
  setDraft(content: string): void;
  saveFile(): Promise<void>;

  toggleExpanded(path: string): void;
  setCreationDir(path: string | null): void;
  refreshEdenState(): Promise<void>;
  refreshManifest(): Promise<void>;
  setSideView(view: "files" | "search" | "world" | "themes"): void;
  setPaletteOpen(open: boolean): void;
  setSettingsOpen(open: boolean, initialTab?: string): void;
  setExportOpen(open: boolean): void;
  setEditSource(editSource: boolean): void;
  setMainView(view: "editor" | "timeline" | "corkboard"): void;
  showModal(options: ModalOptions): Promise<string | null>;
  bumpSearchFocus(): void;
  toggleFocusMode(currentWords: number): void;
  setReveal(reveal: { path: string; term: string } | null): void;
  openWikiLink(raw: string): Promise<void>;
  openMention(key: string): Promise<void>;

  handleEdenEvent(payload: EdenEventPayload): Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  edenState: null,
  edenManifest: null,
  edenOpenError: null,
  tree: [],
  openFile: null,
  expanded: new Set(["world"]),
  creationDir: null,
  toasts: [],
  indexing: null,
  sideView: "files",
  paletteOpen: false,
  searchFocusSeq: 0,
  focusMode: false,
  focusStartWords: null,
  reveal: null,
  settingsOpen: false,
  settingsInitialTab: null,
  exportOpen: false,
  editSource: false,
  mainView: "editor",
  modalRequest: null,

  async init() {
    const state = await window.edenwright.eden.state();
    set({ edenState: state, edenManifest: state.current?.manifest ?? null });
    if (state.current) await get().refreshTree();
  },

  toast(message, kind = "info") {
    const id = (toastSeq += 1);
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  async refreshTree() {
    const seq = ++treeRefreshSeq;
    const tree = await window.edenwright.eden.tree();
    if (seq !== treeRefreshSeq) return; // a newer refresh is on its way
    set({ tree });
  },

  async refreshEdenState() {
    const state = await window.edenwright.eden.state();
    set({ edenState: state, edenManifest: state.current?.manifest ?? null });
  },

  async refreshManifest() {
    if (!get().edenState?.current) return;
    const manifest = await window.edenwright.eden.manifest();
    set({ edenManifest: manifest });
  },

  setExportOpen(open) {
    set({ exportOpen: open });
  },

  setEditSource(editSource) {
    set({ editSource });
  },

  setMainView(view) {
    set({ mainView: view });
  },

  async createEden(parentDir, name, input) {
    try {
      const state = await window.edenwright.eden.create(parentDir, name, input);
      set({
        edenState: state,
        edenManifest: state.current?.manifest ?? null,
        openFile: null,
        edenOpenError: null,
      });
      await get().refreshTree();
      get().toast(`Welcome to ${name}. Plant your first file.`);
      return true;
    } catch (error) {
      get().toast(ipcErrorMessage(error), "warn");
      return false;
    }
  },

  async openEden(path) {
    set({ edenOpenError: null });
    try {
      const state = await window.edenwright.eden.open(path);
      set({
        edenState: state,
        edenManifest: state.current?.manifest ?? null,
        openFile: null,
      });
      await get().refreshTree();
      return true;
    } catch (error) {
      // Toast and inline (launcher) — a failed open explains itself in place.
      const message = ipcErrorMessage(error);
      set({ edenOpenError: message });
      get().toast(message, "warn");
      return false;
    }
  },

  async closeEden() {
    await window.edenwright.eden.close();
    // Invalidate any refresh in flight — it must not land after the wipe.
    treeRefreshSeq += 1;
    set({ openFile: null, tree: [], edenManifest: null, edenOpenError: null });
    const state = await window.edenwright.eden.state();
    set({ edenState: state });
  },

  async removeRecentEden(path) {
    const recents = await window.edenwright.eden.removeRecent(path);
    const state = get().edenState;
    if (state) set({ edenState: { ...state, recents } });
  },

  async openFileAt(path) {
    try {
      const file = await window.edenwright.files.read(path);
      set({
        openFile: {
          path,
          content: file.content,
          savedContent: file.content,
          mtimeMs: file.mtimeMs,
          saving: false,
        },
        editSource: false,
        mainView: "editor",
      });
    } catch (error) {
      get().toast(ipcErrorMessage(error), "warn");
    }
  },

  closeFile() {
    set({ openFile: null });
  },

  setDraft(content) {
    const openFile = get().openFile;
    if (!openFile) return;
    set({ openFile: { ...openFile, content } });
  },

  async saveFile() {
    const openFile = get().openFile;
    if (!openFile || openFile.saving) return;
    if (openFile.content === openFile.savedContent) return;

    set({ openFile: { ...openFile, saving: true } });
    try {
      const result = await window.edenwright.files.write(
        openFile.path,
        openFile.content,
        openFile.mtimeMs,
      );
      if (result.conflictedPath) {
        get().toast(
          "This file changed on disk — your version was saved beside it as a conflicted copy.",
          "warn",
        );
        // Reload the disk version; the writer's words live in the copy.
        await get().openFileAt(openFile.path);
        await get().refreshTree();
      } else {
        set({
          openFile: {
            ...get().openFile!,
            savedContent: openFile.content,
            mtimeMs: result.mtimeMs,
            saving: false,
          },
        });
        get().toast("Saved.");
      }
    } catch (error) {
      set({ openFile: { ...get().openFile!, saving: false } });
      get().toast(ipcErrorMessage(error), "warn");
    }
  },

  toggleExpanded(path) {
    const expanded = new Set(get().expanded);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    set({ expanded });
  },

  setCreationDir(path) {
    set({ creationDir: path });
  },

  setSideView(view) {
    set({ sideView: view });
  },

  setPaletteOpen(open) {
    set({ paletteOpen: open });
  },

  setSettingsOpen(open, initialTab) {
    set({
      settingsOpen: open,
      settingsInitialTab: initialTab ?? null,
    });
  },

  showModal(options) {
    return new Promise<string | null>((resolve) => {
      set({ modalRequest: { options, resolve } });
    });
  },

  bumpSearchFocus() {
    set((state) => ({
      sideView: "search",
      searchFocusSeq: state.searchFocusSeq + 1,
    }));
  },

  toggleFocusMode(currentWords) {
    const entering = !get().focusMode;
    set({
      focusMode: entering,
      focusStartWords: entering ? currentWords : null,
    });
  },

  setReveal(reveal) {
    set({ reveal });
  },

  async openWikiLink(raw) {
    const path = await window.edenwright.query.resolveLink(raw);
    if (path) {
      await get().openFileAt(path);
    } else {
      get().toast(`Nothing called "${raw}" yet.`, "warn");
    }
  },

  async openMention(key) {
    const entities = await window.edenwright.query.entities();
    const entity = entities.find(
      (candidate) =>
        candidate.name.split(/\s+/)[0].toLowerCase() === key ||
        candidate.stableId === key ||
        candidate.stableId === `ent_${key}` ||
        candidate.aliases.some(
          (alias) =>
            alias.toLowerCase() === key ||
            alias.split(/\s+/)[0].toLowerCase() === key,
        ),
    );
    if (entity) {
      await get().openFileAt(entity.path);
    } else {
      get().toast(`No entity called "@${key}" yet.`, "warn");
    }
  },

  async handleEdenEvent(payload) {
    const { openFile, refreshTree, toast } = get();
    switch (payload.type) {
      case "eden-opened": {
        // Eden state changed outside renderer actions (e.g. bridge calls) —
        // never rely on startup timing to learn it.
        const state = await window.edenwright.eden.state();
        set({
          edenState: state,
          edenManifest: state.current?.manifest ?? null,
        });
        await refreshTree();
        break;
      }
      case "eden-closed": {
        const state = await window.edenwright.eden.state();
        treeRefreshSeq += 1; // in-flight refreshes must not land after this
        set({ edenState: state, edenManifest: null, openFile: null, tree: [] });
        break;
      }
      case "settings-changed": {
        const state = await window.edenwright.eden.state();
        set({
          edenState: state,
          edenManifest: state.current?.manifest ?? null,
        });
        break;
      }
      case "tree-changed":
        await refreshTree();
        break;
      case "file-changed": {
        if (!openFile || openFile.path !== payload.path) break;
        if (payload.mtimeMs === 0) {
          if (openFile.content !== openFile.savedContent) {
            toast(
              "This file was deleted on disk — your unsaved copy stays here until you decide.",
              "warn",
            );
          } else {
            set({ openFile: null });
            toast("The open file was deleted on disk.", "warn");
          }
          break;
        }
        if (openFile.content === openFile.savedContent) {
          await get().openFileAt(payload.path);
          toast("Updated from disk.");
        } else {
          toast(
            "This file changed on disk — saving will write a conflicted copy.",
            "warn",
          );
        }
        break;
      }
      case "index-progress":
        set({ indexing: { done: payload.done, total: payload.total } });
        break;
      case "index-rebuilt":
        set({ indexing: null });
        break;
      case "notice":
        toast(payload.message, "warn");
        break;
    }
  },
}));

/** Convenience selector: word count of the current draft. */
export function selectDraftWordCount(state: AppState): number {
  if (!state.openFile) return 0;
  return countWords(state.openFile.content);
}
