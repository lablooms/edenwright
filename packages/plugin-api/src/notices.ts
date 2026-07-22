/** Notices and modals (SPEC §9.2). Warm, direct, never corporate (§3.4). */

export interface NoticeOptions {
  /** Auto-dismiss after this many ms; 0 = sticky until dismissed. */
  timeoutMs?: number;
}

export interface ModalAction {
  id: string;
  label: string;
  /** Primary action gets the leaf accent. At most one per modal. */
  primary?: boolean;
}

export interface ModalOptions {
  title: string;
  /** Body copy — one warm sentence beats a stack trace. */
  body: string;
  actions: ModalAction[];
}

export interface NoticeApi {
  /** Transient toast. */
  show(message: string, options?: NoticeOptions): void;
  /** Modal dialog; resolves the chosen action id, or null when dismissed. */
  modal(options: ModalOptions): Promise<string | null>;
}
