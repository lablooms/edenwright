/**
 * Turn a user's search box text into a safe FTS5 MATCH expression.
 * Terms become quoted phrases joined with AND semantics — no syntax errors
 * from stray quotes or FTS operators typed by a novelist.
 */
export function buildFtsQuery(userInput: string): string {
  return userInput
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" ");
}
