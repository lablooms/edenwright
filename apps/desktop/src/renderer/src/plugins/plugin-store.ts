import type { Extension } from "@codemirror/state";
import { BUILTIN_PRESETS } from "@edenwright/core";
import type {
  Command,
  Disposable,
  EditorExtensionFactory,
  EntityTypeDefinition,
  ExporterDefinition,
  PluginManifest,
  PresetDefinition,
  ReactViewDefinition,
  RibbonItem,
  SettingsTabDefinition,
  StatusBarItem,
  VanillaViewDefinition,
} from "@edenwright/plugin-api";
import { create } from "zustand";

/** A plugin folder found under .eden/plugins/, with its manifest or why not. */
export interface DiscoveredPlugin {
  dir: string;
  manifest: PluginManifest | null;
  error: string | null;
}

export type RegisteredView =
  | ({ kind: "vanilla" } & VanillaViewDefinition)
  | ({ kind: "react" } & ReactViewDefinition);

/**
 * Everything plugins have registered, as plain zustand state — the UI
 * surfaces (palette, sidebar, status bar, settings, editor) read from here
 * and re-render. Disposing a registration removes its slice.
 */
interface PluginSurfaceState {
  discovered: DiscoveredPlugin[];
  /** Ids of plugins actually loaded right now. */
  activeIds: string[];
  commands: Command[];
  ribbonItems: RibbonItem[];
  statusBarItems: StatusBarItem[];
  views: RegisteredView[];
  settingsTabs: SettingsTabDefinition[];
  editorExtensions: (Extension | EditorExtensionFactory)[];
  entityTypes: EntityTypeDefinition[];
  exporters: ExporterDefinition[];
  presets: PresetDefinition[];
  /** The plugin view currently shown in the side panel, when any. */
  activeViewId: string | null;

  setDiscovered(discovered: DiscoveredPlugin[]): void;
  setActiveIds(ids: string[]): void;
  setActiveViewId(id: string | null): void;
  reset(): void;

  addCommand(command: Command): Disposable;
  addRibbonItem(item: RibbonItem): Disposable;
  addStatusBarItem(item: StatusBarItem): Disposable;
  addView(view: RegisteredView): Disposable;
  addSettingsTab(tab: SettingsTabDefinition): Disposable;
  addEditorExtension(extension: Extension | EditorExtensionFactory): Disposable;
  addEntityType(def: EntityTypeDefinition): Disposable;
  addExporter(def: ExporterDefinition): Disposable;
  addPreset(preset: PresetDefinition): Disposable;
}

function addTo<T>(list: T[], entry: T, idOf: (entry: T) => string): T[] {
  return [...list.filter((item) => idOf(item) !== idOf(entry)), entry];
}

function removeFrom<T>(list: T[], entry: T): T[] {
  return list.filter((item) => item !== entry);
}

export const usePluginStore = create<PluginSurfaceState>((set) => ({
  discovered: [],
  activeIds: [],
  commands: [],
  ribbonItems: [],
  statusBarItems: [],
  views: [],
  settingsTabs: [],
  editorExtensions: [],
  entityTypes: [],
  exporters: [],
  // Built-in presets are data (SPEC v2 §6); plugins may add more.
  presets: [...BUILTIN_PRESETS],
  activeViewId: null,

  setDiscovered: (discovered) => set({ discovered }),
  setActiveIds: (activeIds) => set({ activeIds }),
  setActiveViewId: (activeViewId) => set({ activeViewId }),

  reset: () =>
    set({
      discovered: [],
      activeIds: [],
      commands: [],
      ribbonItems: [],
      statusBarItems: [],
      views: [],
      settingsTabs: [],
      editorExtensions: [],
      entityTypes: [],
      exporters: [],
      presets: [...BUILTIN_PRESETS],
      activeViewId: null,
    }),

  addCommand: (command) => {
    set((s) => ({ commands: addTo(s.commands, command, (c) => c.id) }));
    return {
      dispose: () =>
        set((s) => ({ commands: removeFrom(s.commands, command) })),
    };
  },

  addRibbonItem: (item) => {
    set((s) => ({ ribbonItems: addTo(s.ribbonItems, item, (i) => i.id) }));
    return {
      dispose: () =>
        set((s) => ({ ribbonItems: removeFrom(s.ribbonItems, item) })),
    };
  },

  addStatusBarItem: (item) => {
    set((s) => ({
      statusBarItems: addTo(s.statusBarItems, item, (i) => i.id),
    }));
    return {
      dispose: () =>
        set((s) => ({
          statusBarItems: removeFrom(s.statusBarItems, item),
        })),
    };
  },

  addView: (view) => {
    set((s) => ({ views: addTo(s.views, view, (v) => v.id) }));
    return {
      dispose: () =>
        set((s) => ({
          views: removeFrom(s.views, view),
          activeViewId: s.activeViewId === view.id ? null : s.activeViewId,
        })),
    };
  },

  addSettingsTab: (tab) => {
    set((s) => ({ settingsTabs: addTo(s.settingsTabs, tab, (t) => t.id) }));
    return {
      dispose: () =>
        set((s) => ({ settingsTabs: removeFrom(s.settingsTabs, tab) })),
    };
  },

  addEditorExtension: (extension) => {
    set((s) => ({ editorExtensions: [...s.editorExtensions, extension] }));
    return {
      dispose: () =>
        set((s) => ({
          editorExtensions: removeFrom(s.editorExtensions, extension),
        })),
    };
  },

  addEntityType: (def) => {
    set((s) => ({ entityTypes: addTo(s.entityTypes, def, (d) => d.type) }));
    return {
      dispose: () =>
        set((s) => ({ entityTypes: removeFrom(s.entityTypes, def) })),
    };
  },

  addExporter: (def) => {
    set((s) => ({ exporters: addTo(s.exporters, def, (d) => d.id) }));
    return {
      dispose: () => set((s) => ({ exporters: removeFrom(s.exporters, def) })),
    };
  },

  addPreset: (preset) => {
    set((s) => ({ presets: addTo(s.presets, preset, (p) => p.id) }));
    return {
      dispose: () => set((s) => ({ presets: removeFrom(s.presets, preset) })),
    };
  },
}));
