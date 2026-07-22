import { contextBridge, ipcRenderer } from "electron";

import type {
  EdenEventPayload,
  EdenwrightApi,
  EdenwrightPlatform,
} from "./api.js";

const api: EdenwrightApi = {
  platform: process.platform as EdenwrightPlatform,
  appVersion: () => ipcRenderer.invoke("app:get-version"),
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChanged: (callback) => {
      const listener = (_event: unknown, isMaximized: boolean) => {
        callback(isMaximized);
      };
      ipcRenderer.on("window:maximized-changed", listener);
      return () => {
        ipcRenderer.removeListener("window:maximized-changed", listener);
      };
    },
  },
  eden: {
    state: () => ipcRenderer.invoke("eden:state"),
    create: (parentDir, name) =>
      ipcRenderer.invoke("eden:create", parentDir, name),
    open: (path) => ipcRenderer.invoke("eden:open", path),
    close: () => ipcRenderer.invoke("eden:close"),
    pickDirectory: (title) => ipcRenderer.invoke("eden:pick-directory", title),
    tree: () => ipcRenderer.invoke("eden:tree"),
    saveSettings: (settings) =>
      ipcRenderer.invoke("eden:save-settings", settings),
    onEvent: (callback) => {
      const listener = (_event: unknown, payload: EdenEventPayload) => {
        callback(payload);
      };
      ipcRenderer.on("eden:event", listener);
      return () => {
        ipcRenderer.removeListener("eden:event", listener);
      };
    },
  },
  files: {
    read: (relPath) => ipcRenderer.invoke("file:read", relPath),
    write: (relPath, content, baseMtimeMs) =>
      ipcRenderer.invoke("file:write", relPath, content, baseMtimeMs),
    createFile: (relPath) => ipcRenderer.invoke("file:create-file", relPath),
    createFolder: (relPath) =>
      ipcRenderer.invoke("file:create-folder", relPath),
    rename: (from, to) => ipcRenderer.invoke("file:rename", from, to),
    delete: (relPath) => ipcRenderer.invoke("file:delete", relPath),
  },
  query: {
    search: (query, filter) =>
      ipcRenderer.invoke("query:search", query, filter),
    files: () => ipcRenderer.invoke("query:files"),
    entities: () => ipcRenderer.invoke("query:entities"),
    resolveLink: (raw) => ipcRenderer.invoke("query:resolve-link", raw),
    backlinks: (targetRaw) => ipcRenderer.invoke("query:backlinks", targetRaw),
    outgoingLinks: (sourcePath) =>
      ipcRenderer.invoke("query:outgoing-links", sourcePath),
    appearances: (entityKey) =>
      ipcRenderer.invoke("query:appearances", entityKey),
    fileInfo: (path) => ipcRenderer.invoke("query:file-info", path),
    timeline: () => ipcRenderer.invoke("query:timeline"),
    corkboard: (containerPrefix) =>
      ipcRenderer.invoke("query:corkboard", containerPrefix),
    stats: (container, days) =>
      ipcRenderer.invoke("query:stats", container, days),
  },
  plugins: {
    discover: () => ipcRenderer.invoke("plugins:discover"),
    installFromFolder: (sourceDir) =>
      ipcRenderer.invoke("plugins:install-from-folder", sourceDir),
  },
  pluginfs: {
    read: (relPath) => ipcRenderer.invoke("pluginfs:read", relPath),
    readBinary: (relPath) =>
      ipcRenderer.invoke("pluginfs:read-binary", relPath),
    write: (relPath, content) =>
      ipcRenderer.invoke("pluginfs:write", relPath, content),
    writeBinary: (relPath, data) =>
      ipcRenderer.invoke("pluginfs:write-binary", relPath, data),
    list: (relPath) => ipcRenderer.invoke("pluginfs:list", relPath),
    mkdir: (relPath) => ipcRenderer.invoke("pluginfs:mkdir", relPath),
    remove: (relPath) => ipcRenderer.invoke("pluginfs:remove", relPath),
    rename: (from, to) => ipcRenderer.invoke("pluginfs:rename", from, to),
    exists: (relPath) => ipcRenderer.invoke("pluginfs:exists", relPath),
    stat: (relPath) => ipcRenderer.invoke("pluginfs:stat", relPath),
  },
  projects: {
    create: (input) => ipcRenderer.invoke("projects:create", input),
    list: () => ipcRenderer.invoke("projects:list"),
    update: (name, patch) => ipcRenderer.invoke("projects:update", name, patch),
  },
  worlds: {
    create: (name) => ipcRenderer.invoke("worlds:create", name),
    list: () => ipcRenderer.invoke("worlds:list"),
  },
  entities: {
    forProject: (projectName) =>
      ipcRenderer.invoke("entities:for-project", projectName),
    promoteToWorld: (entityRelPath, worldName) =>
      ipcRenderer.invoke("entities:promote-to-world", entityRelPath, worldName),
  },
  history: {
    versions: (relPath) => ipcRenderer.invoke("history:versions", relPath),
    readVersion: (snapshotName, relPath) =>
      ipcRenderer.invoke("history:read-version", snapshotName, relPath),
    restore: (snapshotName, relPath) =>
      ipcRenderer.invoke("history:restore", snapshotName, relPath),
  },
  exporter: {
    renderPdf: (html, outRelPath) =>
      ipcRenderer.invoke("export:render-pdf", html, outRelPath),
  },
  app: {
    revealPath: (relPath) => ipcRenderer.invoke("app:reveal-path", relPath),
    version: () => ipcRenderer.invoke("app:version"),
    openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  },
};

if (process.env.EDENWRIGHT_TEST === "1") {
  api.test = {
    snapshotNow: () => ipcRenderer.invoke("test:snapshot-now"),
    indexStats: () => ipcRenderer.invoke("test:index-stats"),
    whenRebuilt: () => ipcRenderer.invoke("test:when-rebuilt"),
  };
}

contextBridge.exposeInMainWorld("edenwright", api);
