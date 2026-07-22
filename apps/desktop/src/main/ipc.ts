import { app, ipcMain } from "electron";

import type {
  CreateProjectInput,
  EdenSettings,
  SearchFilter,
} from "@edenwright/core";

import type { EdenService } from "./eden-service.js";
import type { RecentEdensStore } from "./recent-edens.js";
import type { ElectronDialogAdapter } from "./adapters/electron-dialogs.js";
import type { NodeFileSystemAdapter } from "./adapters/node-file-system.js";
import type { ElectronShellAdapter } from "./adapters/electron-shell.js";
import { renderPdfToFile } from "./pdf-renderer.js";

const isTest = process.env.EDENWRIGHT_TEST === "1";

/**
 * Every renderer ↔ eden channel. Test hooks exist only under
 * EDENWRIGHT_TEST=1 (e2e drives the bridge without native dialogs).
 */
export function registerEdenIpc(
  service: EdenService,
  recents: RecentEdensStore,
  dialogs: ElectronDialogAdapter,
  fs: NodeFileSystemAdapter,
  shell: ElectronShellAdapter,
): void {
  ipcMain.handle("eden:state", async () => ({
    current: service.state(),
    recents: await recents.list(),
  }));

  ipcMain.handle(
    "eden:create",
    async (_event, parentDir: string, name: string) => {
      await service.create(parentDir, name);
      return { current: service.state(), recents: await recents.list() };
    },
  );

  ipcMain.handle("eden:open", async (_event, path: string) => {
    await service.open(path);
    return { current: service.state(), recents: await recents.list() };
  });

  ipcMain.handle("eden:close", async () => {
    await service.close();
  });

  ipcMain.handle("eden:pick-directory", async (_event, title?: string) =>
    dialogs.pickDirectory({ title }),
  );

  ipcMain.handle("eden:tree", () => service.tree());

  ipcMain.handle("file:read", (_event, relPath: string) =>
    service.readFile(relPath),
  );

  ipcMain.handle(
    "file:write",
    (_event, relPath: string, content: string, baseMtimeMs: number | null) =>
      service.writeFile(relPath, content, baseMtimeMs),
  );

  ipcMain.handle("file:create-file", (_event, relPath: string) =>
    service.createFile(relPath),
  );

  ipcMain.handle("file:create-folder", (_event, relPath: string) =>
    service.createFolder(relPath),
  );

  ipcMain.handle("file:rename", (_event, from: string, to: string) =>
    service.rename(from, to),
  );

  ipcMain.handle("file:delete", (_event, relPath: string) =>
    service.delete(relPath),
  );

  ipcMain.handle(
    "query:search",
    (_event, query: string, filter?: SearchFilter) =>
      service.search(query, filter),
  );

  ipcMain.handle("query:files", () => service.listFiles());

  ipcMain.handle("query:entities", () => service.listEntities());

  ipcMain.handle("query:resolve-link", (_event, raw: string) =>
    service.resolveLink(raw),
  );

  ipcMain.handle("query:backlinks", (_event, targetRaw: string) =>
    service.backlinks(targetRaw),
  );

  ipcMain.handle("query:outgoing-links", (_event, sourcePath: string) =>
    service.outgoingLinks(sourcePath),
  );

  ipcMain.handle("query:appearances", (_event, entityKey: string) =>
    service.entityAppearances(entityKey),
  );

  ipcMain.handle("query:file-info", (_event, path: string) =>
    service.fileInfo(path),
  );

  ipcMain.handle("query:timeline", () => service.timeline());

  ipcMain.handle("query:corkboard", (_event, containerPrefix?: string) =>
    service.corkboard(containerPrefix),
  );

  ipcMain.handle("query:stats", (_event, container: string, days?: number) =>
    service.stats(container, days),
  );

  ipcMain.handle("history:versions", (_event, relPath: string) =>
    service.historyVersions(relPath),
  );

  ipcMain.handle(
    "history:read-version",
    (_event, snapshotName: string, relPath: string) =>
      service.historyReadVersion(snapshotName, relPath),
  );

  ipcMain.handle(
    "history:restore",
    (_event, snapshotName: string, relPath: string) =>
      service.historyRestore(snapshotName, relPath),
  );

  ipcMain.handle("export:render-pdf", (_event, html: string, relPath: string) =>
    renderPdfToFile(html, service.resolveInsideEdenPublic(relPath), fs),
  );

  ipcMain.handle("app:reveal-path", (_event, relPath: string) =>
    shell.revealPath(service.resolveInsideEdenPublic(relPath)),
  );

  ipcMain.handle("app:version", () => app.getVersion());

  ipcMain.handle("app:open-external", (_event, url: string) => {
    // The update check links out; only ever https, only ever a browser.
    if (typeof url !== "string" || !url.startsWith("https://")) return;
    return shell.openExternal(url);
  });

  ipcMain.handle("pluginfs:stat", (_event, relPath: string) =>
    service.pluginfsStat(relPath),
  );

  ipcMain.handle("projects:create", (_event, input: CreateProjectInput) =>
    service.createProject(input),
  );

  ipcMain.handle("projects:list", () => service.listProjects());

  ipcMain.handle(
    "projects:update",
    (
      _event,
      name: string,
      patch: {
        linkedWorlds?: string[];
        goals?: { targetWords?: number; dailyWords?: number };
        order?: string[];
      },
    ) => service.updateProject(name, patch),
  );

  ipcMain.handle("entities:for-project", (_event, projectName: string) =>
    service.entitiesForProject(projectName),
  );

  ipcMain.handle(
    "entities:promote-to-world",
    (_event, entityRelPath: string, worldName: string) =>
      service.moveEntityToWorld(entityRelPath, worldName),
  );

  ipcMain.handle("worlds:create", (_event, name: string) =>
    service.createWorld(name),
  );

  ipcMain.handle("worlds:list", () => service.listWorlds());

  ipcMain.handle("eden:save-settings", (_event, settings: EdenSettings) =>
    service.saveSettings(settings),
  );

  ipcMain.handle("plugins:discover", () => service.discoverPlugins());

  ipcMain.handle("plugins:install-from-folder", (_event, sourceDir: string) =>
    service.installPluginFromFolder(sourceDir),
  );

  ipcMain.handle("pluginfs:read", (_event, relPath: string) =>
    service.pluginfsRead(relPath),
  );
  ipcMain.handle("pluginfs:read-binary", (_event, relPath: string) =>
    service.pluginfsReadBinary(relPath),
  );
  ipcMain.handle("pluginfs:write", (_event, relPath: string, content: string) =>
    service.pluginfsWrite(relPath, content),
  );
  ipcMain.handle(
    "pluginfs:write-binary",
    (_event, relPath: string, data: Uint8Array) =>
      service.pluginfsWriteBinary(relPath, data),
  );
  ipcMain.handle("pluginfs:list", (_event, relPath: string) =>
    service.pluginfsList(relPath),
  );
  ipcMain.handle("pluginfs:mkdir", (_event, relPath: string) =>
    service.pluginfsMkdir(relPath),
  );
  ipcMain.handle("pluginfs:remove", (_event, relPath: string) =>
    service.pluginfsRemove(relPath),
  );
  ipcMain.handle("pluginfs:rename", (_event, from: string, to: string) =>
    service.pluginfsRename(from, to),
  );
  ipcMain.handle("pluginfs:exists", (_event, relPath: string) =>
    service.pluginfsExists(relPath),
  );

  if (isTest) {
    ipcMain.handle("test:snapshot-now", () => service.snapshotNow());
    ipcMain.handle("test:index-stats", () => service.indexStats());
    ipcMain.handle("test:when-rebuilt", () => service.whenRebuilt());
  }
}
