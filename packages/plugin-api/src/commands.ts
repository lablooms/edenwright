import type { Disposable } from "./disposable.js";

/** A command appears in the command palette and can be bound to a hotkey. */
export interface Command {
  /** Unique id, conventionally "<plugin-id>:<verb>", e.g. "sprints:start". */
  id: string;
  /** Palette label, plain English. */
  name: string;
  /** Optional default hotkey, e.g. "Mod-Shift-P". Users can rebind. */
  hotkey?: string;
  callback: () => void;
}

export interface CommandRegistry {
  register(command: Command): Disposable;
}
