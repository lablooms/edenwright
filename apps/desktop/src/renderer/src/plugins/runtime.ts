import type { Extension } from "@codemirror/state";
import * as cmCommands from "@codemirror/commands";
import * as cmLanguage from "@codemirror/language";
import * as cmSearch from "@codemirror/search";
import * as cmState from "@codemirror/state";
import * as cmView from "@codemirror/view";
import type { FileSystemAdapter } from "@edenwright/core";
import * as pluginApi from "@edenwright/plugin-api";
import {
  isVersionAtLeast,
  validatePluginManifest,
} from "@edenwright/plugin-api";
import type {
  Disposable,
  EdenwrightPlugin,
  FileEvent,
  PluginContext,
  PluginManifest,
} from "@edenwright/plugin-api";

import type { EdenwrightApi } from "../../../preload/api";
import type { ModalOptions } from "@edenwright/plugin-api";
import { useAppStore } from "../store";
import { usePluginStore, type DiscoveredPlugin } from "./plugin-store";

interface ActivePlugin {
  manifest: PluginManifest;
  plugin: EdenwrightPlugin;
  disposables: Disposable[];
  styleElement: HTMLStyleElement | null;
}

interface FileListener {
  kind: "create" | "change" | "delete" | "rename";
  callback: (event: FileEvent) => void;
}

export interface RuntimeDeps {
  bridge: EdenwrightApi;
  appVersion: string;
}

/**
 * The plugin runtime (SPEC §9). Plugins live in the renderer (they touch the
 * DOM and CodeMirror), are evaluated as CJS modules with an allow-list of imports —
 * `@edenwright/plugin-api`, the app’s own `@codemirror/*` instances, and
 * their own manifest — and every
 * registration lands in the plugin store as a Disposable. Unloading disposes
 * everything the plugin ever registered.
 */
export class PluginRuntime {
  private readonly active = new Map<string, ActivePlugin>();
  private readonly fileListeners = new Map<string, FileListener[]>();
  private appVersionCache: string | null = null;

  constructor(private readonly deps: RuntimeDeps) {}

  private async appVersion(): Promise<string> {
    if (!this.appVersionCache) {
      this.appVersionCache = await this.deps.bridge.appVersion();
    }
    return this.appVersionCache;
  }

  /** Plugins under .eden/plugins/ with validation results (§9.1). */
  async discover(): Promise<DiscoveredPlugin[]> {
    const dirs = await this.deps.bridge.plugins.discover();
    return dirs.map(({ dir, manifestText }) => {
      if (!manifestText) {
        return { dir, manifest: null, error: "No manifest.json inside." };
      }
      try {
        const validation = validatePluginManifest(JSON.parse(manifestText));
        return validation.ok
          ? { dir, manifest: validation.manifest, error: null }
          : { dir, manifest: null, error: validation.error };
      } catch {
        return {
          dir,
          manifest: null,
          error: "manifest.json isn't valid JSON.",
        };
      }
    });
  }

  /** Discover + reconcile loaded plugins with the eden's settings (§9.3). */
  async syncFromSettings(): Promise<void> {
    const appStore = useAppStore.getState();
    const pluginStore = usePluginStore.getState();
    const settings = appStore.edenState?.current?.settings;
    if (!settings) return;

    const discovered = await this.discover();
    pluginStore.setDiscovered(discovered);

    if (settings.plugins.restrictedMode) {
      // Restricted mode silences every community plugin (§9.3).
      for (const id of [...this.active.keys()]) {
        await this.disable(id);
      }
      return;
    }

    for (const id of settings.plugins.enabled) {
      if (this.active.has(id)) continue;
      const entry = discovered.find((item) => item.manifest?.id === id);
      if (!entry?.manifest) continue;
      await this.enableWithTrust(entry.manifest);
    }

    for (const id of [...this.active.keys()]) {
      if (!settings.plugins.enabled.includes(id)) {
        await this.disable(id);
      }
    }
    this.syncActiveIds();
  }

  private async enableWithTrust(manifest: PluginManifest): Promise<void> {
    const appStore = useAppStore.getState();
    const settings = appStore.edenState?.current?.settings;
    if (!settings) return;

    if (!isVersionAtLeast(await this.appVersion(), manifest.minAppVersion)) {
      appStore.toast(
        `${manifest.name} needs Edenwright ${manifest.minAppVersion} or newer.`,
        "warn",
      );
      return;
    }

    // The blunt one-time trust dialog (§9.3).
    if (!settings.plugins.trustAcknowledged.includes(manifest.id)) {
      const choice = await appStore.showModal({
        title: `Enable ${manifest.name}?`,
        body: "Plugins run with the same access as Edenwright itself, including your files. Only install plugins you trust.",
        actions: [
          { id: "enable", label: "Enable plugin", primary: true },
          { id: "cancel", label: "Cancel" },
        ],
      });
      if (choice !== "enable") return;
      await this.persistSettings({
        ...settings,
        plugins: {
          ...settings.plugins,
          trustAcknowledged: [
            ...settings.plugins.trustAcknowledged,
            manifest.id,
          ],
        },
      });
    }

    await this.enable(manifest);
  }

  private async enable(manifest: PluginManifest): Promise<void> {
    if (this.active.has(manifest.id)) return;
    const appStore = useAppStore.getState();
    const disposables: Disposable[] = [];

    let code: string;
    try {
      code = await this.deps.bridge.pluginfs.read(
        `.eden/plugins/${manifest.id}/main.js`,
      );
    } catch {
      appStore.toast(`${manifest.name}: no main.js inside.`, "warn");
      return;
    }

    let styleElement: HTMLStyleElement | null = null;
    try {
      const css = await this.deps.bridge.pluginfs.read(
        `.eden/plugins/${manifest.id}/styles.css`,
      );
      styleElement = document.createElement("style");
      styleElement.dataset.plugin = manifest.id;
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
    } catch {
      styleElement = null; // styles.css is optional (§9.1)
    }

    try {
      const plugin = this.evaluate(manifest, code);
      const context = this.createContext(manifest, disposables);
      await plugin.onload(context);
      this.active.set(manifest.id, {
        manifest,
        plugin,
        disposables,
        styleElement,
      });
      this.syncActiveIds();
    } catch (error) {
      for (const disposable of disposables.reverse()) {
        try {
          disposable.dispose();
        } catch {
          // Keep unwinding — a half-failed plugin must leave nothing behind.
        }
      }
      styleElement?.remove();
      const message = error instanceof Error ? error.message : String(error);
      appStore.toast(`${manifest.name} failed to load: ${message}`, "warn");
    }
  }

  private evaluate(manifest: PluginManifest, code: string): EdenwrightPlugin {
    const moduleShim: { exports: unknown } = { exports: {} };
    // The app's own module instances — a plugin's CM extension must share
    // class identity with the editor's CodeMirror (a second copy breaks
    // instanceof). This is the whole allow-list; everything else is inlined.
    const modules: Record<string, unknown> = {
      "@edenwright/plugin-api": pluginApi,
      "@codemirror/state": cmState,
      "@codemirror/view": cmView,
      "@codemirror/commands": cmCommands,
      "@codemirror/language": cmLanguage,
      "@codemirror/search": cmSearch,
      "./manifest.json": manifest,
    };
    const requireShim = (id: string): unknown => {
      if (id in modules) return modules[id];
      throw new Error(
        `Plugin "${manifest.id}" required "${id}" — only @edenwright/plugin-api, @codemirror/*, and ./manifest.json are allowed.`,
      );
    };
    // Plugins are trusted code by explicit user choice (§9.3); evaluation is
    // the runtime model, like Obsidian's.
    const factory = new Function("module", "exports", "require", code);
    factory(moduleShim, moduleShim.exports, requireShim);

    // The shim's exports start as unknown; the shape check below narrows it.
    const exportsObj = moduleShim.exports as Record<string, unknown>;
    const candidate = (exportsObj.default ??
      moduleShim.exports) as Partial<EdenwrightPlugin>;
    if (!candidate || typeof candidate.onload !== "function") {
      throw new Error("main.js must export a plugin with an onload() method.");
    }
    return candidate as EdenwrightPlugin;
  }

  async disable(id: string): Promise<void> {
    const entry = this.active.get(id);
    if (!entry) return;
    try {
      await entry.plugin.onunload?.();
    } catch {
      // onunload errors never block disposal.
    }
    for (const disposable of [...entry.disposables].reverse()) {
      try {
        disposable.dispose();
      } catch {
        // Keep unwinding.
      }
    }
    entry.styleElement?.remove();
    this.fileListeners.delete(id);
    this.active.delete(id);
    this.syncActiveIds();
  }

  /** Unload every plugin (eden closing carries them all with it). */
  async unloadAll(): Promise<void> {
    for (const id of [...this.active.keys()]) {
      await this.disable(id);
    }
  }

  /** Fan watcher events out to plugins (§9.2 file events). */
  emitFileEvent(kind: "create" | "change" | "delete", path: string): void {
    const event: FileEvent = { kind, path };
    for (const listeners of this.fileListeners.values()) {
      for (const listener of listeners) {
        if (listener.kind === kind) {
          try {
            listener.callback(event);
          } catch {
            // A plugin's listener never takes the app down with it.
          }
        }
      }
    }
  }

  private syncActiveIds(): void {
    usePluginStore.getState().setActiveIds([...this.active.keys()]);
  }

  private async persistSettings(
    settings: import("@edenwright/core").EdenSettings,
  ): Promise<void> {
    await this.deps.bridge.eden.saveSettings(settings);
    // settings-changed flows back through the event stream.
  }

  private pluginFs(): FileSystemAdapter {
    const bridge = this.deps.bridge;
    return {
      readFile: (path) => bridge.pluginfs.read(path),
      readFileBinary: (path) => bridge.pluginfs.readBinary(path),
      writeFile: (path, contents) => bridge.pluginfs.write(path, contents),
      writeFileBinary: (path, data) => bridge.pluginfs.writeBinary(path, data),
      exists: (path) => bridge.pluginfs.exists(path),
      stat: (path) => bridge.pluginfs.stat(path),
      list: (dirPath) => bridge.pluginfs.list(dirPath),
      mkdir: (path) => bridge.pluginfs.mkdir(path),
      remove: (path) => bridge.pluginfs.remove(path),
      move: (from, to) => bridge.pluginfs.rename(from, to),
    };
  }

  private createContext(
    manifest: PluginManifest,
    disposables: Disposable[],
  ): PluginContext {
    const push = (disposable: Disposable): Disposable => {
      disposables.push(disposable);
      return disposable;
    };
    const pluginStore = usePluginStore.getState();
    const appStore = useAppStore.getState();
    const bridge = this.deps.bridge;
    const listeners: FileListener[] = [];
    this.fileListeners.set(manifest.id, listeners);

    return {
      appVersion: this.appVersionCache ?? "0.1.0-beta",
      manifest,
      eden: {
        // Lazy: the community tab is reachable before any eden opens.
        get rootPath() {
          return useAppStore.getState().edenState?.current?.info.path ?? "";
        },
        fs: this.pluginFs(),
      },
      commands: {
        register: (command) => push(pluginStore.addCommand(command)),
      },
      workspace: {
        registerView: (view) =>
          push(pluginStore.addView({ kind: "vanilla", ...view })),
        registerReactView: (view) =>
          push(pluginStore.addView({ kind: "react", ...view })),
        registerRibbonItem: (item) => push(pluginStore.addRibbonItem(item)),
        registerStatusBarItem: (item) =>
          push(pluginStore.addStatusBarItem(item)),
        openView: (id) => pluginStore.setActiveViewId(id),
        openFile: (path) => {
          void appStore.openFileAt(path);
        },
      },
      editor: {
        registerExtension: (extension: Extension) =>
          push(pluginStore.addEditorExtension(extension)),
      },
      settings: {
        registerTab: (tab) => push(pluginStore.addSettingsTab(tab)),
      },
      entities: {
        registerType: (def) => push(pluginStore.addEntityType(def)),
      },
      exporters: {
        register: (def) => push(pluginStore.addExporter(def)),
      },
      presets: {
        register: (preset) => push(pluginStore.addPreset(preset)),
      },
      events: {
        on: (kind, callback) => {
          const listener: FileListener = { kind, callback };
          listeners.push(listener);
          const disposable: Disposable = {
            dispose: () => {
              const index = listeners.indexOf(listener);
              if (index >= 0) listeners.splice(index, 1);
            },
          };
          return push(disposable);
        },
      },
      index: {
        searchText: (query, filter) =>
          bridge.query.search(query, {
            containerPath: filter?.containerPath,
            kind: filter?.kind,
            status: filter?.status,
          }),
        getOutgoingLinks: async (filePath) =>
          (await bridge.query.outgoingLinks(filePath)).map((row) => ({
            sourcePath: filePath,
            target: row.targetRaw ?? "",
            kind: (row.kind === "mention" ? "mention" : "wiki") as
              "mention" | "wiki",
          })),
        getBacklinks: async (filePath) =>
          (await bridge.query.backlinks(filePath)).map((row) => ({
            sourcePath: row.sourcePath ?? "",
            target: filePath,
            kind: (row.kind === "mention" ? "mention" : "wiki") as
              "mention" | "wiki",
          })),
        getEntityAppearances: (entityId) => bridge.query.appearances(entityId),
        getDailyWords: async (containerPath, days) =>
          (await bridge.query.stats(containerPath, days)).series,
        listEntities: async (containerPath) =>
          (await bridge.query.entities())
            .filter((entity) =>
              containerPath ? entity.path.startsWith(containerPath) : true,
            )
            .map((entity) => ({
              path: entity.path,
              name: entity.name,
              id: entity.stableId ?? undefined,
              type: entity.entityType ?? "character",
              aliases: entity.aliases,
              world: entity.world ?? undefined,
            })),
        getFileInfo: async (path) => {
          const info = await bridge.query.fileInfo(path);
          return info
            ? {
                path: info.path,
                id: info.stableId ?? undefined,
                title: info.title,
                wordCount: info.wordCount,
                frontmatter: info.frontmatter,
              }
            : null;
        },
      },
      notices: {
        show: (message) => {
          appStore.toast(message);
        },
        modal: (options: ModalOptions) => appStore.showModal(options),
      },
    };
  }
}

/** Singleton — created once by the App and fed with the live bridge. */
export const pluginRuntime = new PluginRuntime({
  bridge: window.edenwright,
  appVersion: "0.1.0-beta",
});
