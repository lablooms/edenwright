import type { BrowserWindow } from "electron";
import { dialog } from "electron";

import type {
  ConfirmOptions,
  DialogAdapter,
  PickOptions,
} from "@edenwright/core";

/** Dialog adapter over Electron's native dialogs, parented to the window. */
export class ElectronDialogAdapter implements DialogAdapter {
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async pickDirectory(options?: PickOptions): Promise<string | null> {
    const window = this.getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  }

  async pickFile(options?: PickOptions): Promise<string | null> {
    const window = this.getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      properties: ["openFile"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const window = this.getWindow();
    if (!window) return false;
    const confirmLabel = options.confirmLabel ?? "OK";
    const result = await dialog.showMessageBox(window, {
      type: "question",
      title: options.title,
      message: options.title,
      detail: options.message,
      buttons: [confirmLabel, options.cancelLabel ?? "Cancel"],
      defaultId: 0,
      cancelId: 1,
    });
    return result.response === 0;
  }
}
