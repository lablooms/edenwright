/**
 * Timeline math (SPEC §7.6). `storyDate` is a YYYY-MM-DD string — possibly a
 * fictional calendar, so we never use real-world epoch math: ordinals are
 * linear approximations good for ordering and spacing, nothing more.
 */

const DATE_RE = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/;
const DAYS_PER_YEAR = 372;
const DAYS_PER_MONTH = 31;

/**
 * Story-date string → linear ordinal, or null when unparseable.
 * Approximate by design: consistent ordering and rough spacing for any
 * calendar a writer invents.
 */
export function storyDateToOrdinal(storyDate: string): number | null {
  const match = DATE_RE.exec(storyDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year * DAYS_PER_YEAR + (month - 1) * DAYS_PER_MONTH + day;
}

/** Ordinal → padded YYYY-MM-DD story-date string (inverse of the above). */
export function ordinalToStoryDate(ordinal: number): string {
  const year = Math.floor((ordinal - 1) / DAYS_PER_YEAR);
  const rem = (ordinal - 1) % DAYS_PER_YEAR;
  const month = Math.floor(rem / DAYS_PER_MONTH) + 1;
  const day = (rem % DAYS_PER_MONTH) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface TimelineCollision {
  /** The shared entity key, e.g. "yuki". */
  entityKey: string;
  /** Files that put the entity in two places at the same story-date. */
  paths: string[];
}

/**
 * Best-effort continuity flags (§7.6): files sharing one story-date that
 * mention the same entity — someone is in two places at once. Advisory only.
 */
export function findTimelineCollisions(
  datedFiles: readonly { path: string; ordinal: number }[],
  mentionsByPath: ReadonlyMap<string, readonly string[]>,
): TimelineCollision[] {
  const byDay = new Map<number, string[]>();
  for (const file of datedFiles) {
    const list = byDay.get(file.ordinal) ?? [];
    list.push(file.path);
    byDay.set(file.ordinal, list);
  }

  const collisions: TimelineCollision[] = [];
  for (const paths of byDay.values()) {
    if (paths.length < 2) continue;
    const counts = new Map<string, string[]>();
    for (const path of paths) {
      for (const key of mentionsByPath.get(path) ?? []) {
        const list = counts.get(key) ?? [];
        if (!list.includes(path)) list.push(path);
        counts.set(key, list);
      }
    }
    for (const [entityKey, entityPaths] of counts) {
      if (entityPaths.length >= 2) {
        collisions.push({ entityKey, paths: entityPaths.sort() });
      }
    }
  }
  return collisions.sort((a, b) => a.entityKey.localeCompare(b.entityKey));
}
