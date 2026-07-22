import JSZip from "jszip";

import type { SnapshotInfo, SnapshotSettings } from "@edenwright/core";
import {
  EDEN_META_DIR,
  EDEN_SNAPSHOTS_DIR,
  joinPath,
  planSnapshotPruning,
  snapshotFileName,
} from "@edenwright/core";

import type { NodeFileSystemAdapter } from "./adapters/node-file-system.js";

/**
 * Zip snapshots of changed files into `.eden/snapshots/` (SPEC §5.4), pruned
 * oldest-first under the configured cap. Snapshots are the safety net under
 * every bulk operation — restore (M5) writes files, never rewrites history.
 */
export class SnapshotManager {
  constructor(
    private readonly fs: NodeFileSystemAdapter,
    private readonly edenRoot: string,
    private readonly settings: SnapshotSettings,
  ) {}

  private get snapshotsDir(): string {
    return joinPath(this.edenRoot, EDEN_META_DIR, EDEN_SNAPSHOTS_DIR);
  }

  /**
   * Zip the given eden-relative files (those still on disk) into a new
   * snapshot. Returns the snapshot file name, or null when there was
   * nothing to save.
   */
  async createSnapshot(
    changedRelPaths: readonly string[],
  ): Promise<string | null> {
    const zip = new JSZip();
    let included = 0;

    for (const relPath of changedRelPaths) {
      const absPath = joinPath(this.edenRoot, relPath);
      const stat = await this.fs.stat(absPath);
      if (stat?.kind !== "file") continue;
      zip.file(relPath, await this.fs.readFileBinary(absPath));
      included += 1;
    }

    if (included === 0) return null;

    const name = snapshotFileName(new Date());
    const data = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    await this.fs.writeFileBinary(joinPath(this.snapshotsDir, name), data);
    return name;
  }

  async list(): Promise<SnapshotInfo[]> {
    let entries;
    try {
      entries = await this.fs.list(this.snapshotsDir);
    } catch {
      return [];
    }
    const snapshots: SnapshotInfo[] = [];
    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.name.endsWith(".zip")) continue;
      const stat = await this.fs.stat(joinPath(this.snapshotsDir, entry.name));
      if (!stat) continue;
      snapshots.push({
        name: entry.name,
        sizeBytes: stat.size,
        createdAtMs: stat.modifiedAtMs,
      });
    }
    return snapshots;
  }

  /** Prune per policy; returns the deleted snapshot names. */
  async prune(): Promise<string[]> {
    const toDelete = planSnapshotPruning(
      await this.list(),
      this.settings.maxTotalBytes,
    );
    for (const name of toDelete) {
      await this.fs.remove(joinPath(this.snapshotsDir, name));
    }
    return toDelete;
  }

  /** Snapshots that contain a version of `relPath`, newest first (§7.9). */
  async listVersions(relPath: string): Promise<SnapshotInfo[]> {
    const snapshots = await this.list();
    const versions: SnapshotInfo[] = [];
    for (const snapshot of snapshots) {
      try {
        const zip = await JSZip.loadAsync(
          await this.fs.readFileBinary(
            joinPath(this.snapshotsDir, snapshot.name),
          ),
        );
        if (zip.file(relPath)) {
          versions.push(snapshot);
        }
      } catch {
        // A corrupt zip is skipped, never fatal (it's a cache of a cache).
      }
    }
    return versions.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  /** Extract one file's content from a snapshot, or null when absent. */
  async readVersion(
    snapshotName: string,
    relPath: string,
  ): Promise<string | null> {
    try {
      const zip = await JSZip.loadAsync(
        await this.fs.readFileBinary(joinPath(this.snapshotsDir, snapshotName)),
      );
      const entry = zip.file(relPath);
      if (!entry) return null;
      return await entry.async("string");
    } catch {
      return null;
    }
  }
}
