import type { ComponentType } from "react";

import type { Disposable } from "./disposable.js";

/** A settings tab contributed by a plugin (SPEC §9.2). */
export interface SettingsTabDefinition {
  id: string;
  /** Tab label, plain English. */
  title: string;
  component: ComponentType;
}

export interface SettingsRegistry {
  registerTab(tab: SettingsTabDefinition): Disposable;
}
