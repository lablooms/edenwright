/** OS shell capability (open URLs, reveal files). Implemented with Electron `shell`. */

export interface ShellAdapter {
  /** Open an http(s) URL in the user's browser. Other schemes are rejected. */
  openExternal(url: string): Promise<void>;

  /** Reveal a file or folder in the OS file manager. */
  revealPath(path: string): Promise<void>;
}
