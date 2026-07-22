/**
 * Snapshot retention policy (SPEC §5.4): zip snapshots live in
 * `.eden/snapshots/`, capped in total size (default 500 MB), pruned
 * oldest-first. Pure logic — the shell does the zipping and deleting.
 */

export interface SnapshotInfo {
  /** File name inside the snapshots folder. */
  name: string;
  sizeBytes: number;
  createdAtMs: number;
}

/**
 * Which snapshots to delete so the total stays within `maxTotalBytes`.
 * The newest snapshot is always kept, even when it alone exceeds the cap —
 * pruning never deletes the only safety net.
 */
export function planSnapshotPruning(
  snapshots: SnapshotInfo[],
  maxTotalBytes: number,
): string[] {
  const sorted = [...snapshots].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const toDelete: string[] = [];
  let keptTotal = 0;

  for (const [index, snapshot] of sorted.entries()) {
    if (index === 0) {
      keptTotal += snapshot.sizeBytes;
      continue;
    }
    if (keptTotal + snapshot.sizeBytes > maxTotalBytes) {
      toDelete.push(snapshot.name);
    } else {
      keptTotal += snapshot.sizeBytes;
    }
  }
  // Return oldest-first: predictable logs and deletion order.
  return toDelete.sort(
    (a, b) =>
      sorted.find((s) => s.name === a)!.createdAtMs -
      sorted.find((s) => s.name === b)!.createdAtMs,
  );
}

/**
 * `snapshot-2026-07-21T01-23-45-678.zip` — ISO-ish, colon-free for Windows,
 * millisecond precision: two snapshots in one second must never overwrite
 * each other (golden rule 7 — a collision would silently destroy a version).
 */
export function snapshotFileName(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds(),
  )}-${pad(date.getMilliseconds(), 3)}`;
  return `snapshot-${stamp}.zip`;
}
