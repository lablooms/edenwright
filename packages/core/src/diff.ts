/**
 * Line-based diff for the history view (SPEC §7.9): LCS over line arrays —
 * small and honest, no word-level cleverness.
 */

export interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
}

/** Diff `older` against `newer`: removed lines from older, added from newer. */
export function diffLines(older: string, newer: string): DiffLine[] {
  const a = older.split("\n");
  const b = newer.split("\n");

  // LCS table
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: "remove", text: a[i] });
      i += 1;
    } else {
      result.push({ type: "add", text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    result.push({ type: "remove", text: a[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ type: "add", text: b[j] });
    j += 1;
  }
  return result;
}
