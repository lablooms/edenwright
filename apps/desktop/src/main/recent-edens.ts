import { join } from "node:path";

import { app } from "electron";

import { NodeFileSystemAdapter } from "./adapters/node-file-system.js";

export interface RecentEden {
  name: string;
  path: string;
  /** Preset id of the eden (absent on entries written before R2). */
  preset?: string;
  /** The preset's medium tag, denormalized for the launcher icon. */
  medium?: string;
  /** ISO time of the last successful open. */
  lastOpenedAt?: string;
}

/** What older recent-edens.json files may hold — R1 entries and earlier. */
interface StoredRecentEden {
  name?: unknown;
  path?: unknown;
  preset?: unknown;
  medium?: unknown;
  lastOpenedAt?: unknown;
  lastOpenedAtMs?: unknown;
}

const MAX_RECENTS = 10;

/** Old entries stay readable; missing details read as "unknown", not broken. */
function normalizeStored(entry: StoredRecentEden): RecentEden | null {
  if (typeof entry?.name !== "string" || typeof entry?.path !== "string") {
    return null;
  }
  const recent: RecentEden = { name: entry.name, path: entry.path };
  if (typeof entry.preset === "string") recent.preset = entry.preset;
  if (typeof entry.medium === "string") recent.medium = entry.medium;
  if (typeof entry.lastOpenedAt === "string") {
    recent.lastOpenedAt = entry.lastOpenedAt;
  } else if (typeof entry.lastOpenedAtMs === "number") {
    // Pre-R2 timestamps were epoch millis under another key — carry them over.
    recent.lastOpenedAt = new Date(entry.lastOpenedAtMs).toISOString();
  }
  return recent;
}

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
    let stored: StoredRecentEden[];
    try {
      const raw: unknown = JSON.parse(await this.fs.readFile(this.filePath));
      stored = Array.isArray(raw) ? (raw as StoredRecentEden[]) : [];
    } catch {
      return [];
    }

    const alive: RecentEden[] = [];
    let changed = false;
    for (const entry of stored) {
      const recent = normalizeStored(entry);
      if (!recent) {
        changed = true;
        continue;
      }
      // Lazy prune: a folder that vanished drops out at read time, so the
      // launcher never offers a dead path.
      if (await this.fs.exists(recent.path)) {
        alive.push(recent);
      } else {
        changed = true;
      }
    }
    const next = alive.slice(0, MAX_RECENTS);
    if (changed || alive.length > MAX_RECENTS) await this.persist(next);
    return next;
  }

  /** Backfilled on every successful open/create, so details stay fresh. */
  async touch(info: {
    name: string;
    path: string;
    preset?: string;
    medium?: string;
  }): Promise<void> {
    const rest = (await this.list()).filter(
      (entry) => entry.path !== info.path,
    );
    const next: RecentEden[] = [
      {
        name: info.name,
        path: info.path,
        preset: info.preset,
        medium: info.medium,
        lastOpenedAt: new Date().toISOString(),
      },
      ...rest,
    ].slice(0, MAX_RECENTS);
    await this.persist(next);
  }

  /** Forget an entry — the eden's files are never touched. */
  async remove(path: string): Promise<void> {
    await this.persist(
      (await this.list()).filter((entry) => entry.path !== path),
    );
  }

  private async persist(entries: RecentEden[]): Promise<void> {
    await this.fs.writeFile(
      this.filePath,
      `${JSON.stringify(entries, null, 2)}\n`,
    );
  }
}
