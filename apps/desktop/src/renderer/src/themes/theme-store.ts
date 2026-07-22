import {
  DEFAULT_THEME_ID,
  parseThemeManifest,
  type InstalledTheme,
} from "@edenwright/core";
import { create } from "zustand";

/**
 * Theme management (SPEC §9.5). Themes are plain CSS-variable packs in
 * `.eden/themes/<id>/`; the active one is injected as a <style> override
 * after the base tokens. The built-in dark theme is the base tokens
 * themselves — an empty override — so it can never be uninstalled or broken.
 */

const STYLE_ELEMENT_ID = "ew-theme-override";

export const BUILTIN_THEME: InstalledTheme = {
  manifest: {
    id: DEFAULT_THEME_ID,
    name: "Edenwright Dark",
    version: "0.1.0-beta",
    description: "The default dark look — void, abyss, and leaf (SPEC §3.1).",
    author: "Lablooms Studio",
  },
  css: "",
  builtin: true,
};

interface ThemeState {
  installed: InstalledTheme[];
  active: string;
  /** Read `.eden/themes/` and apply the eden's active theme. */
  refresh(): Promise<void>;
  apply(id: string): Promise<void>;
  install(id: string, manifestJson: string, css: string): Promise<void>;
  remove(id: string): Promise<void>;
}

function applyCss(css: string): void {
  let element = document.getElementById(
    STYLE_ELEMENT_ID,
  ) as HTMLStyleElement | null;
  if (!element) {
    element = document.createElement("style");
    element.id = STYLE_ELEMENT_ID;
    document.head.appendChild(element);
  }
  element.textContent = css;
}

function themeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  installed: [BUILTIN_THEME],
  active: DEFAULT_THEME_ID,

  async refresh() {
    const bridge = window.edenwright;
    const installed: InstalledTheme[] = [BUILTIN_THEME];
    try {
      const entries = await bridge.pluginfs.list(".eden/themes");
      for (const entry of entries) {
        if (entry.kind !== "directory") continue;
        try {
          const manifest = parseThemeManifest(
            JSON.parse(
              await bridge.pluginfs.read(
                `.eden/themes/${entry.name}/manifest.json`,
              ),
            ),
          );
          if (typeof manifest === "string") continue; // invalid → skip quietly
          const css = await bridge.pluginfs.read(
            `.eden/themes/${entry.name}/theme.css`,
          );
          installed.push({ manifest, css, builtin: false });
        } catch {
          // A half-installed theme is skipped, never fatal (§9.5 spirit).
        }
      }
    } catch {
      // No themes dir yet — the builtin is still there.
    }

    const state = await bridge.eden.state();
    const active = state.current?.settings.theme.active ?? DEFAULT_THEME_ID;
    const found =
      installed.find((theme) => theme.manifest.id === active) ?? BUILTIN_THEME;
    applyCss(found.css);
    set({ installed, active: found.manifest.id });
  },

  async apply(id) {
    const theme = get().installed.find((item) => item.manifest.id === id);
    if (!theme) return;
    applyCss(theme.css);
    set({ active: id });
    const state = await window.edenwright.eden.state();
    if (!state.current) return;
    await window.edenwright.eden.saveSettings({
      ...state.current.settings,
      theme: { active: id },
    });
  },

  async install(id, manifestJson, css) {
    const bridge = window.edenwright;
    const dir = `.eden/themes/${id}`;
    if (await bridge.pluginfs.exists(dir)) {
      throw new Error(`Theme "${id}" is already installed.`);
    }
    await bridge.pluginfs.mkdir(dir);
    try {
      await bridge.pluginfs.write(`${dir}/manifest.json`, manifestJson);
      await bridge.pluginfs.write(`${dir}/theme.css`, css);
    } catch (error) {
      // Never leave a half-written theme behind.
      await bridge.pluginfs.remove(dir).catch(() => undefined);
      throw new Error(themeError(error));
    }
    await get().refresh();
  },

  async remove(id) {
    if (id === DEFAULT_THEME_ID) return; // not uninstallable (SPEC §9.5)
    await window.edenwright.pluginfs.remove(`.eden/themes/${id}`);
    if (get().active === id) {
      await get().apply(DEFAULT_THEME_ID);
    }
    await get().refresh();
  },
}));
