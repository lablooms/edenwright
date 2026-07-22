/** Native dialog capability. Implemented with Electron `dialog` in the shell. */

export interface PickOptions {
  title?: string;
  defaultPath?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface DialogAdapter {
  /** Ask for a folder. Resolves null when cancelled. */
  pickDirectory(options?: PickOptions): Promise<string | null>;

  /** Ask for a single file. Resolves null when cancelled. */
  pickFile(options?: PickOptions): Promise<string | null>;

  /** Modal confirmation. Resolves true only on explicit confirm. */
  confirm(options: ConfirmOptions): Promise<boolean>;
}
