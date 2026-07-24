import { useEffect, useState } from "react";
import {
  BarChart3,
  Clapperboard,
  Download,
  PanelsTopLeft,
  Puzzle,
  Scroll,
  Sparkles,
  Timer,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { EdenSettings } from "@edenwright/core";

import { Button } from "@edenwright/ui";

import { ipcErrorMessage, useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { pluginRuntime } from "../plugins/runtime";
import { listCorePlugins, type CorePluginInfo } from "../plugins/core-plugins";
import "./settings-modal.css";

const FONT_OPTIONS = [
  { id: "literata", label: "Literata (default)" },
  { id: "space-grotesk", label: "Space Grotesk" },
  { id: "jetbrains-mono", label: "JetBrains Mono" },
  { id: "courier-prime", label: "Courier Prime" },
];

const BUILTIN_TABS = [
  { id: "editor", title: "Editor" },
  { id: "snapshots", title: "Snapshots" },
  { id: "plugins", title: "Plugins" },
];

/** Core plugin id → glyph (the same icons the plugins use on the ribbon). */
const CORE_PLUGIN_ICONS: Record<string, LucideIcon> = {
  "lablooms.screenplay-mode": Clapperboard,
  "lablooms.comic-rail": PanelsTopLeft,
  "lablooms.story-canvas": Waypoints,
  "lablooms.medium-exporters": Download,
  "lablooms.sprints": Timer,
  "lablooms.stats-deluxe": BarChart3,
  "lablooms.namesmith": Sparkles,
  "lablooms.structure-wizards": Scroll,
};

/** The settings framework (§9.2): built-in tabs plus plugin-contributed ones. */
export function SettingsModal() {
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const settingsInitialTab = useAppStore((state) => state.settingsInitialTab);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const edenState = useAppStore((state) => state.edenState);
  const toast = useAppStore((state) => state.toast);
  const discovered = usePluginStore((state) => state.discovered);
  const activeIds = usePluginStore((state) => state.activeIds);
  const pluginTabs = usePluginStore((state) => state.settingsTabs);

  const [tab, setTab] = useState("editor");
  const [pluginSubtab, setPluginSubtab] = useState<"core" | "installed">(
    "core",
  );
  const [corePlugins, setCorePlugins] = useState<CorePluginInfo[]>([]);
  const [draft, setDraft] = useState<EdenSettings | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      setDraft(edenState?.current?.settings ?? null);
      setTab(settingsInitialTab ?? "editor");
      setPluginSubtab("core");
      void listCorePlugins().then(setCorePlugins);
    }
    // Opening re-reads the live settings; editing edits the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  if (!settingsOpen || !draft) return null;

  const settings = edenState?.current?.settings;
  const dirty = settings && JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    try {
      await window.edenwright.eden.saveSettings(draft);
      toast("Settings saved.");
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const togglePlugin = async (id: string, enabled: boolean) => {
    if (!settings) return;
    const next: EdenSettings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        enabled: enabled
          ? [...settings.plugins.enabled, id]
          : settings.plugins.enabled.filter((item) => item !== id),
      },
    };
    try {
      await window.edenwright.eden.saveSettings(next);
      await pluginRuntime.syncFromSettings();
      setDraft(next);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  // Core plugins are first-party: no trust dialog, no install — the toggle
  // is the whole interaction, and it applies immediately (R5).
  const toggleCorePlugin = async (id: string, enabled: boolean) => {
    if (!settings) return;
    const next: EdenSettings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        coreDisabled: enabled
          ? settings.plugins.coreDisabled.filter((item) => item !== id)
          : [...settings.plugins.coreDisabled, id],
      },
    };
    try {
      await window.edenwright.eden.saveSettings(next);
      await pluginRuntime.syncFromSettings();
      setDraft(next);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const installFromFolder = async () => {
    const chosen = await window.edenwright.eden.pickDirectory(
      "Pick a plugin folder (with manifest.json inside)",
    );
    if (!chosen || !settings) return;
    try {
      const id = await window.edenwright.plugins.installFromFolder(chosen);
      toast("Installed. Enable it when you're ready.");
      const next: EdenSettings = {
        ...settings,
        plugins: {
          ...settings.plugins,
          enabled: [...settings.plugins.enabled, id],
        },
      };
      await window.edenwright.eden.saveSettings(next);
      await pluginRuntime.syncFromSettings();
      setDraft(next);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const tabs = [
    ...BUILTIN_TABS,
    ...pluginTabs.map((pluginTab) => ({
      id: `plugin:${pluginTab.id}`,
      title: pluginTab.title,
    })),
  ];

  return (
    <div
      className="settings-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSettingsOpen(false);
      }}
    >
      <div className="settings" role="dialog" aria-label="Settings">
        <nav className="settings__nav">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className="settings__nav-item"
              data-active={tab === item.id || undefined}
              onClick={() => setTab(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <div className="settings__body">
          {tab === "editor" ? (
            <div className="settings__section">
              <h3 className="settings__heading">Editor</h3>
              <label className="settings__field">
                <span className="settings__label">Font</span>
                <select
                  className="settings__select"
                  value={
                    FONT_OPTIONS.some((o) => o.id === draft.editor.fontFamily)
                      ? draft.editor.fontFamily
                      : "custom"
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        fontFamily:
                          value === "custom"
                            ? ""
                            : (value as typeof draft.editor.fontFamily),
                      },
                    });
                  }}
                >
                  {FONT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">System font…</option>
                </select>
              </label>
              {!FONT_OPTIONS.some((o) => o.id === draft.editor.fontFamily) ? (
                <label className="settings__field">
                  <span className="settings__label">System font name</span>
                  <input
                    className="settings__input"
                    placeholder="e.g. Georgia"
                    value={draft.editor.fontFamily}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        editor: {
                          ...draft.editor,
                          fontFamily: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ) : null}
              <label className="settings__field">
                <span className="settings__label">
                  Font size — {draft.editor.fontSize}px
                </span>
                <input
                  className="settings__range"
                  type="range"
                  min={14}
                  max={22}
                  step={1}
                  value={draft.editor.fontSize}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        fontSize: Number(event.target.value) || 17,
                      },
                    })
                  }
                />
              </label>
              <label className="settings__field">
                <span className="settings__label">
                  Line width —{" "}
                  {draft.editor.lineWidth <= 60
                    ? "narrow"
                    : draft.editor.lineWidth >= 84
                      ? "wide"
                      : "comfortable"}
                </span>
                <input
                  className="settings__range"
                  type="range"
                  min={52}
                  max={92}
                  step={4}
                  value={draft.editor.lineWidth}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        lineWidth: Number(event.target.value) || 72,
                      },
                    })
                  }
                />
              </label>
              <label className="settings__check">
                <input
                  type="checkbox"
                  checked={draft.editor.smartTypography}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        smartTypography: event.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Smart typography — curl quotes, em-dashes, ellipses as you
                  type
                </span>
              </label>
              <label className="settings__check">
                <input
                  type="checkbox"
                  checked={draft.editor.spellcheck}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        spellcheck: event.target.checked,
                      },
                    })
                  }
                />
                <span>Check spelling while I write</span>
              </label>
              <label className="settings__check">
                <input
                  type="checkbox"
                  checked={draft.editor.typewriterMode}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      editor: {
                        ...draft.editor,
                        typewriterMode: event.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Typewriter scrolling — keep the line I'm writing centered
                </span>
              </label>
            </div>
          ) : null}

          {tab === "snapshots" ? (
            <div className="settings__section">
              <h3 className="settings__heading">Snapshots</h3>
              <label className="settings__field">
                <span className="settings__label">
                  Snapshot every (minutes)
                </span>
                <input
                  className="settings__input settings__input--number"
                  type="number"
                  min={1}
                  value={draft.snapshots.intervalMinutes}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      snapshots: {
                        ...draft.snapshots,
                        intervalMinutes: Math.max(
                          1,
                          Number(event.target.value) || 10,
                        ),
                      },
                    })
                  }
                />
              </label>
              <label className="settings__field">
                <span className="settings__label">Keep at most (MB)</span>
                <input
                  className="settings__input settings__input--number"
                  type="number"
                  min={10}
                  value={Math.round(
                    draft.snapshots.maxTotalBytes / (1024 * 1024),
                  )}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      snapshots: {
                        ...draft.snapshots,
                        maxTotalBytes:
                          Math.max(10, Number(event.target.value) || 500) *
                          1024 *
                          1024,
                      },
                    })
                  }
                />
              </label>
              <p className="settings__note">
                Snapshots zip changed files into .eden/snapshots — your safety
                net under every bulk operation.
              </p>
            </div>
          ) : null}

          {tab === "plugins" ? (
            <div className="settings__section">
              <h3 className="settings__heading">Plugins</h3>
              <div className="settings__subtabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pluginSubtab === "core"}
                  data-active={pluginSubtab === "core" || undefined}
                  className="settings__subtab"
                  onClick={() => setPluginSubtab("core")}
                >
                  Core plugins
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pluginSubtab === "installed"}
                  data-active={pluginSubtab === "installed" || undefined}
                  className="settings__subtab"
                  onClick={() => setPluginSubtab("installed")}
                >
                  Installed plugins
                </button>
              </div>

              {pluginSubtab === "core" ? (
                <>
                  <p className="settings__note">
                    Made by Lablooms and built into the app — nothing to
                    install, nothing to trust. Turn off what you don't use.
                  </p>
                  <ul className="settings__plugin-list">
                    {corePlugins.map((entry) => {
                      const enabled = !draft.plugins.coreDisabled.includes(
                        entry.manifest.id,
                      );
                      const PluginIcon =
                        CORE_PLUGIN_ICONS[entry.manifest.id] ?? Puzzle;
                      return (
                        <li
                          key={entry.manifest.id}
                          className="settings__plugin"
                        >
                          <PluginIcon
                            size={16}
                            className="settings__plugin-icon"
                            aria-hidden
                          />
                          <div className="settings__plugin-info">
                            <span className="settings__plugin-name">
                              {entry.manifest.name}
                            </span>
                            <span className="settings__plugin-desc">
                              {entry.manifest.description}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            title={enabled ? "Enabled" : "Disabled"}
                            checked={enabled}
                            onChange={(event) =>
                              void toggleCorePlugin(
                                entry.manifest.id,
                                event.target.checked,
                              )
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <label className="settings__check">
                    <input
                      type="checkbox"
                      checked={draft.plugins.restrictedMode}
                      onChange={(event) => {
                        const restrictedMode = event.target.checked;
                        setDraft({
                          ...draft,
                          plugins: { ...draft.plugins, restrictedMode },
                        });
                        if (settings) {
                          const next: EdenSettings = {
                            ...settings,
                            plugins: { ...settings.plugins, restrictedMode },
                          };
                          void window.edenwright.eden
                            .saveSettings(next)
                            .then(() => pluginRuntime.syncFromSettings());
                        }
                      }}
                    />
                    <span>
                      Restricted mode — turn off all installed plugins (core
                      plugins stay on)
                    </span>
                  </label>

                  {discovered.length === 0 ? (
                    <p className="settings__note">
                      No extra plugins yet — the core plugins cover the basics,
                      and community plugins are coming after beta. You can still
                      install one from a folder, or copy it into .eden/plugins/
                      yourself.
                    </p>
                  ) : (
                    <ul className="settings__plugin-list">
                      {discovered.map((entry) => (
                        <li key={entry.dir} className="settings__plugin">
                          <Puzzle
                            size={16}
                            className="settings__plugin-icon"
                            aria-hidden
                          />
                          <div className="settings__plugin-info">
                            <span className="settings__plugin-name">
                              {entry.manifest?.name ?? entry.dir}
                            </span>
                            <span className="settings__plugin-meta">
                              {entry.error
                                ? entry.error
                                : `${entry.manifest!.id} · v${entry.manifest!.version}`}
                            </span>
                          </div>
                          {entry.manifest ? (
                            <input
                              type="checkbox"
                              title={
                                draft.plugins.restrictedMode
                                  ? "Restricted mode is on"
                                  : activeIds.includes(entry.manifest.id)
                                    ? "Enabled"
                                    : "Disabled"
                              }
                              disabled={draft.plugins.restrictedMode}
                              checked={draft.plugins.enabled.includes(
                                entry.manifest.id,
                              )}
                              onChange={(event) =>
                                void togglePlugin(
                                  entry.manifest!.id,
                                  event.target.checked,
                                )
                              }
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => void installFromFolder()}
                  >
                    Install from folder…
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {pluginTabs.map((pluginTab) =>
            tab === `plugin:${pluginTab.id}` ? (
              <div className="settings__section" key={pluginTab.id}>
                <h3 className="settings__heading">{pluginTab.title}</h3>
                <pluginTab.component />
              </div>
            ) : null,
          )}
        </div>

        <footer className="settings__footer">
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
            Close
          </Button>
          <Button disabled={!dirty} onClick={() => void save()}>
            Save settings
          </Button>
        </footer>
      </div>
    </div>
  );
}
