/** Export file names: no OS-illegal characters, no stray whitespace. */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}
