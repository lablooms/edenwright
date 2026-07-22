/**
 * Subsequence fuzzy scoring for the quick switcher. Higher is better;
 * null means "not a subsequence". Bonuses for streaks and word starts.
 */
export function fuzzyScore(needle: string, haystack: string): number | null {
  if (needle.length === 0) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  let score = 0;
  let ni = 0;
  let lastMatch = -2;
  let streak = 0;

  for (let hi = 0; hi < h.length && ni < n.length; hi += 1) {
    if (h[hi] === n[ni]) {
      streak = hi === lastMatch + 1 ? streak + 1 : 0;
      const wordStart = hi === 0 || /[\s/_-]/.test(h[hi - 1]);
      score += 1 + streak * 2 + (wordStart ? 5 : 0);
      lastMatch = hi;
      ni += 1;
    }
  }
  return ni === n.length ? score : null;
}
