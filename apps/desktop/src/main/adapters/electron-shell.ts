import { shell } from "electron";

import type { ShellAdapter } from "@edenwright/core";
import { EdenwrightError } from "@edenwright/core";

/** OS shell adapter. External opens are http(s)-only — privacy is absolute. */
export class ElectronShellAdapter implements ShellAdapter {
  async openExternal(url: string): Promise<void> {
    const protocol = new URL(url).protocol;
    if (protocol !== "https:" && protocol !== "http:") {
      throw new EdenwrightError(
        "IO",
        `Refusing to open non-http(s) URL: ${url}`,
      );
    }
    await shell.openExternal(url);
  }

  async revealPath(path: string): Promise<void> {
    shell.showItemInFolder(path);
  }
}
