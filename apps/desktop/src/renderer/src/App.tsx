import { useEffect } from "react";

import { countWords } from "@edenwright/core";
import {
  BloomIcon,
  PanelLayout,
  Sidebar,
  TitleBar,
  type SidebarItem,
} from "@edenwright/ui";
import {
  Files,
  Globe,
  Palette as PaletteIcon,
  Puzzle,
  Search,
  Settings,
} from "lucide-react";

import { CorkboardView } from "./components/corkboard-view";
import { DetailsPanel } from "./components/details-panel";
import { EdenSwitcher } from "./components/eden-switcher";
import { ExportModal } from "./components/export-modal";
import { FilesPanel } from "./components/files-panel";
import { HelpMenu } from "./components/help-menu";
import { Launcher } from "./components/launcher";
import { ModalHost } from "./components/modal-host";
import { Palette } from "./components/palette";
import { PluginViewHost } from "./components/plugin-view-host";
import { SearchPanel } from "./components/search-panel";
import { ThemesPanel } from "./components/themes-panel";
import { SettingsModal } from "./components/settings-modal";
import { StatusBar } from "./components/status-bar";
import { TimelineView } from "./components/timeline-view";
import { Toasts } from "./components/toasts";
import { Viewer } from "./components/viewer";
import { WorldPanel } from "./components/world-panel";
import { lucideByName } from "./lib/icons";
import { pluginRuntime } from "./plugins/runtime";
import { usePluginStore } from "./plugins/plugin-store";
import { useAppStore } from "./store";
import { useChromeStore } from "./chrome-store";
import { useThemeStore } from "./themes/theme-store";
import { checkForUpdates } from "./updates";
import { universalExporter } from "./plugins/universal-exporter";

// Rail: Files, Search, World live; Plugins/Themes/Settings sit at the
// bottom. Vocabulary law (§3.4): plain English, "world" is not a brand word.
const TOP_ITEMS: SidebarItem[] = [
  { id: "files", icon: Files, title: "Files" },
  { id: "search", icon: Search, title: "Search — Ctrl/Cmd-Shift-F" },
  { id: "world", icon: Globe, title: "World" },
];

const BOTTOM_ITEMS: SidebarItem[] = [
  { id: "plugins", icon: Puzzle, title: "Plugins" },
  { id: "themes", icon: PaletteIcon, title: "Themes" },
  { id: "settings", icon: Settings, title: "Settings" },
];

function LoadingView() {
  return (
    <div className="loading-view">
      <BloomIcon size={72} />
      <p className="loading-view__text">Waking the garden…</p>
    </div>
  );
}

export function App() {
  const {
    isMaximized,
    isPanelOpen,
    panelWidth,
    setMaximized,
    togglePanel,
    setPanelWidth,
  } = useChromeStore();
  const edenState = useAppStore((state) => state.edenState);
  const init = useAppStore((state) => state.init);
  const handleEdenEvent = useAppStore((state) => state.handleEdenEvent);
  const sideView = useAppStore((state) => state.sideView);
  const setSideView = useAppStore((state) => state.setSideView);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const focusMode = useAppStore((state) => state.focusMode);
  const mainView = useAppStore((state) => state.mainView);
  const ribbonItems = usePluginStore((state) => state.ribbonItems);
  const activeViewId = usePluginStore((state) => state.activeViewId);
  const bridge = window.edenwright;

  useEffect(() => {
    void init();
    // The universal exporter is built in — every project gets it (§8).
    usePluginStore.getState().addExporter(universalExporter);
    // Notify-only update check (M8): once per start, silent when offline.
    const updateTimer = setTimeout(() => void checkForUpdates(), 3000);
    const unsubscribe = bridge.eden.onEvent((payload) => {
      void handleEdenEvent(payload).then(() => {
        // Plugin runtime reacts to lifecycle, settings, and file events (§9).
        if (
          payload.type === "eden-opened" ||
          payload.type === "settings-changed"
        ) {
          void pluginRuntime.syncFromSettings();
          void useThemeStore.getState().refresh();
        } else if (payload.type === "eden-closed") {
          // Plugins unload with the eden; presets are data and stay.
          void useThemeStore.getState().refresh();
          void pluginRuntime.unloadAll().then(() => {
            const store = usePluginStore.getState();
            store.setDiscovered([]);
            store.setActiveIds([]);
          });
        } else if (payload.type === "plugin-file-event") {
          pluginRuntime.emitFileEvent(payload.kind, payload.path);
        }
      });
    });
    return () => {
      clearTimeout(updateTimer);
      unsubscribe();
    };
  }, [bridge, init, handleEdenEvent]);

  // The eden-opened event can fire before this renderer is listening
  // (startup auto-reopen, bridge-driven creates) — so the runtime also
  // syncs whenever the store learns an eden is open (R5).
  const openEdenPath = useAppStore(
    (state) => state.edenState?.current?.info.path ?? null,
  );
  useEffect(() => {
    if (openEdenPath) void pluginRuntime.syncFromSettings();
  }, [openEdenPath]);

  useEffect(() => {
    let disposed = false;
    void bridge.window.isMaximized().then((value) => {
      if (!disposed) setMaximized(value);
    });
    const unsubscribe = bridge.window.onMaximizedChanged(setMaximized);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [bridge, setMaximized]);

  // The spellchecker is an Electron session switch; keep it in lockstep
  // with the eden's editor settings (default ON, R4).
  const spellcheck = useAppStore(
    (state) => state.edenState?.current?.settings.editor.spellcheck ?? true,
  );
  useEffect(() => {
    void bridge.app.setSpellcheck(spellcheck);
  }, [bridge, spellcheck]);

  // Global hotkeys (§7.3, §7.2): switcher, global search, focus mode.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const store = useAppStore.getState();

      if (mod && !event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        store.setPaletteOpen(!store.paletteOpen);
      } else if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        store.bumpSearchFocus();
      } else if (mod && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        store.toggleFocusMode(
          store.openFile ? countWords(store.openFile.content) : 0,
        );
      } else if (
        event.key === "Escape" &&
        store.focusMode &&
        !store.paletteOpen
      ) {
        event.preventDefault();
        store.toggleFocusMode(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const edenOpen = Boolean(edenState?.current);

  const ribbonTop: SidebarItem[] = ribbonItems
    .filter((item) => item.location === "sidebar-top")
    .map((item) => ({
      id: `ribbon:${item.id}`,
      icon: lucideByName(item.icon),
      title: item.title,
    }));
  const ribbonBottom: SidebarItem[] = ribbonItems
    .filter((item) => item.location === "sidebar-bottom")
    .map((item) => ({
      id: `ribbon:${item.id}`,
      icon: lucideByName(item.icon),
      title: item.title,
    }));

  const onSidebarSelect = (id: string) => {
    if (id === "files") setSideView("files");
    else if (id === "world") setSideView("world");
    else if (id === "themes") setSideView("themes");
    else if (id === "search") useAppStore.getState().bumpSearchFocus();
    else if (id === "plugins") {
      setSideView("files");
      setSettingsOpen(true, "plugins");
    } else if (id === "settings") setSettingsOpen(true);
    else if (id.startsWith("ribbon:")) {
      const ribbonId = id.slice("ribbon:".length);
      ribbonItems.find((item) => item.id === ribbonId)?.onClick();
    }
  };

  return (
    <div className={`app-shell${focusMode ? " app-shell--focus" : ""}`}>
      <TitleBar
        isMac={bridge.platform === "darwin"}
        isMaximized={isMaximized}
        isPanelOpen={isPanelOpen}
        onMinimize={() => void bridge.window.minimize()}
        onToggleMaximize={() => void bridge.window.toggleMaximize()}
        onClose={() => void bridge.window.close()}
        onTogglePanel={togglePanel}
        menu={<HelpMenu />}
        switcher={edenOpen ? <EdenSwitcher /> : undefined}
        onBadgeClick={() => useChromeStore.getState().setAboutOpen(true)}
      />
      <div className="app-shell__body">
        <PanelLayout
          activityBar={
            <Sidebar
              topItems={[...TOP_ITEMS, ...ribbonTop]}
              bottomItems={[...ribbonBottom, ...BOTTOM_ITEMS]}
              activeId={edenOpen ? sideView : null}
              onSelect={onSidebarSelect}
            />
          }
          sidePanel={
            edenOpen ? (
              activeViewId ? (
                <PluginViewHost viewId={activeViewId} />
              ) : sideView === "search" ? (
                <SearchPanel />
              ) : sideView === "world" ? (
                <WorldPanel />
              ) : sideView === "themes" ? (
                <ThemesPanel />
              ) : (
                <FilesPanel />
              )
            ) : undefined
          }
          panel={<DetailsPanel />}
          panelOpen={isPanelOpen && edenOpen}
          panelWidth={panelWidth}
          minPanelWidth={200}
          maxPanelWidth={480}
          onPanelResize={setPanelWidth}
        >
          {edenState === null ? (
            <LoadingView />
          ) : edenOpen ? (
            mainView === "timeline" ? (
              <TimelineView />
            ) : mainView === "corkboard" ? (
              <CorkboardView />
            ) : (
              <Viewer />
            )
          ) : (
            <Launcher />
          )}
        </PanelLayout>
      </div>
      <StatusBar />
      <Palette />
      <SettingsModal />
      <ExportModal />
      <ModalHost />
      <Toasts />
    </div>
  );
}
