import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { ElectronDialogAdapter } from "./adapters/electron-dialogs.js";
import { ElectronShellAdapter } from "./adapters/electron-shell.js";
import { NodeFileSystemAdapter } from "./adapters/node-file-system.js";
import { ChokidarWatcherAdapter } from "./adapters/chokidar-watcher.js";
import { EdenService } from "./eden-service.js";
import { registerEdenIpc } from "./ipc.js";
import { RecentEdensStore } from "./recent-edens.js";

const isMac = process.platform === "darwin";

// e2e runs get a throwaway userData so tests never touch real app state.
// Relaunch specs pin it through the env so recents survive an app restart.
if (process.env.EDENWRIGHT_TEST === "1") {
  const testUserData =
    process.env.EDENWRIGHT_USERDATA ??
    join(app.getPath("temp"), `edenwright-test-userdata-${process.pid}`);
  mkdirSync(testUserData, { recursive: true });
  app.setPath("userData", testUserData);
}

let mainWindow: BrowserWindow | null = null;

/**
 * The shell's half of the Portable Core Law (SPEC §5.3): concrete adapters
 * for the interfaces core defines, plus the eden service orchestrating them.
 */
export const adapters = {
  fs: new NodeFileSystemAdapter(),
  shell: new ElectronShellAdapter(),
  dialogs: new ElectronDialogAdapter(() => mainWindow),
  watcher: new ChokidarWatcherAdapter(),
};

const recents = new RecentEdensStore(adapters.fs);
const edenService = new EdenService(adapters.fs, adapters.watcher, recents);

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // --ew-void as the pre-CSS background: no white flash, no gray box.
    backgroundColor: "#0B0713",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 14, y: 13 },
    autoHideMenuBar: true,
    icon: join(import.meta.dirname, "../../build/icon.png"),
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Built-in spellchecker (R4); the Settings toggle flips it live.
      spellcheck: true,
    },
  });
  mainWindow = window;

  // Follow the app locale would need a language pack story; fixed en-US
  // until then (Electron ships hunspell dictionaries per locale).
  window.webContents.session.setSpellCheckerLanguages(["en-US"]);

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  window.on("maximize", () => {
    window.webContents.send("window:maximized-changed", true);
  });
  window.on("unmaximize", () => {
    window.webContents.send("window:maximized-changed", false);
  });

  // No new windows; external links go to the user's browser, only ever on
  // explicit user action (privacy rule, golden rule 6).
  window.webContents.setWindowOpenHandler(({ url }) => {
    void adapters.shell.openExternal(url);
    return { action: "deny" };
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

function registerWindowIpc(): void {
  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle("window:is-maximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle("window:toggle-devtools", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools();
  });

  ipcMain.handle("app:set-spellcheck", (event, enabled: boolean) => {
    BrowserWindow.fromWebContents(
      event.sender,
    )?.webContents.session.setSpellCheckerEnabled(Boolean(enabled));
  });
}

let finalSnapshotTaken = false;

void app.whenReady().then(async () => {
  edenService.setEventSink((event) => {
    mainWindow?.webContents.send("eden:event", event);
  });

  registerWindowIpc();
  registerEdenIpc(
    edenService,
    recents,
    adapters.dialogs,
    adapters.fs,
    adapters.shell,
  );
  createMainWindow();

  // Auto-reopen: the launcher is for first runs and explicit switches — a
  // returning writer lands straight back in their last eden. list() prunes
  // dead folders, and a failed open just leaves the launcher up.
  const [mostRecent] = await recents.list();
  if (mostRecent) {
    await edenService.open(mostRecent.path).catch(() => undefined);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", (event) => {
  if (finalSnapshotTaken) return;
  // Session end: one last snapshot of everything that changed (SPEC §5.4).
  event.preventDefault();
  finalSnapshotTaken = true;
  void edenService.close().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
