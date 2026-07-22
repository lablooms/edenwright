import type { ComponentType } from "react";

import type { Disposable } from "./disposable.js";

/**
 * Workspace surfaces (SPEC §9.2): views, panels, ribbon items, status bar.
 * A view may be vanilla (render into an element) or React (a component).
 */

export interface VanillaViewDefinition {
  id: string;
  title: string;
  /** Lucide icon name. */
  icon?: string;
  /** Render into `element`; return an optional cleanup. */
  render: (element: HTMLElement) => void | (() => void);
}

export interface ReactViewDefinition {
  id: string;
  title: string;
  /** Lucide icon name. */
  icon?: string;
  component: ComponentType;
}

/** Ribbon positions in the left sidebar. */
export type RibbonLocation = "sidebar-top" | "sidebar-bottom";

export interface RibbonItem {
  id: string;
  /** Lucide icon name. */
  icon: string;
  title: string;
  location: RibbonLocation;
  onClick: () => void;
}

export interface StatusBarItem {
  id: string;
  /** Plain text; update by re-registering. */
  text: string;
  /** Optional command id to run on click. */
  command?: string;
}

export interface WorkspaceRegistry {
  registerView(view: VanillaViewDefinition): Disposable;
  registerReactView(view: ReactViewDefinition): Disposable;
  registerRibbonItem(item: RibbonItem): Disposable;
  registerStatusBarItem(item: StatusBarItem): Disposable;
  /** Bring a registered view to the front in the workspace's side panel. */
  openView(id: string): void;
  /** Open an eden-relative file in the main editor. */
  openFile(path: string): void;
}
