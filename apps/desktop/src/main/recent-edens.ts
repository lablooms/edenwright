import { join } from "node:path";

import { app } from "electron";

import type { EdenInfo } from "@edenwright/core";

import { NodeFileSystemAdapter } from "./adapters/node-file-system.js";

export interface RecentEden {
  name: string;
  path: string;
  lastOpenedAtMs: number;
}

const MAX_RECENTS = 10;

/**
 * MRU list of edens, stored in the app's userData folder — app state, not
 * user content (golden rule 1: user content lives only in the eden).
 */
export class RecentEdensStore {
  private readonly filePath: string;

  constructor(private readonly fs: NodeFileSystemAdapter) {
    this.filePath = join(app.getPath("userData"), "recent-edens.json");
  }

  async list(): Promise<RecentEden[]> {
    try {
      const raw: unknown = JSON.parse(await this.fs.readFile(this.filePath));
      if (!Array.isArray(raw)) return [];
      return raw.filter(
        (entry): entry is RecentEden =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RecentEden).name === "string" &&
          typeof (entry as RecentEden).path === "string",
      );
    } catch {
      return [];
    }
  }

  async touch(info: EdenInfo): Promise<void> {
    const rest = (await this.list()).filter(
      (entry) => entry.path !== info.path,
    );
    const next: RecentEden[] = [
      { name: info.name, path: info.path, lastOpenedAtMs: Date.now() },
      ...rest,
    ].slice(0, MAX_RECENTS);
    await this.fs.writeFile(
      this.filePath,
      `${JSON.stringify(next, null, 2)}\n`,
    );
  }

  async remove(path: string): Promise<void> {
    const next = (await this.list()).filter((entry) => entry.path !== path);
    await this.fs.writeFile(
      this.filePath,
      `${JSON.stringify(next, null, 2)}\n`,
    );
  }
}
