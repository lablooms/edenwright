import { useEffect, useMemo, useState } from "react";
import { CloudOff, Download, RefreshCw, Sprout } from "lucide-react";

import { useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { pluginRuntime } from "../plugins/runtime";
import { useThemeStore } from "../themes/theme-store";
import {
  downloadPluginFiles,
  readEntryAsset,
} from "../community/community-install";
import {
  compareVersions,
  fetchRegistry,
  type RegistryEntry,
  type RegistryResult,
} from "../community/registry-client";

import "./community-section.css";

/**
 * The community tab (SPEC §9.4): browse, search, install, update. Rendered
 * for plugins inside Settings → Plugins and for themes in the Themes panel.
 * Offline = the bundled fixture with a quiet hint; installs then fail soft.
 */
export function CommunitySection({ kind }: { kind: "plugins" | "themes" }) {
  const toast = useAppStore((state) => state.toast);
  const discovered = usePluginStore((state) => state.discovered);
  const installedThemes = useThemeStore((state) => state.installed);

  const [result, setResult] = useState<RegistryResult | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRegistry(kind).then((registry) => {
      if (!cancelled) setResult(registry);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const installedVersions = useMemo(() => {
    const map = new Map<string, string>();
    if (kind === "themes") {
      for (const theme of installedThemes) {
        map.set(theme.manifest.id, theme.manifest.version);
      }
    } else {
      for (const plugin of discovered) {
        if (plugin.manifest)
          map.set(plugin.manifest.id, plugin.manifest.version);
      }
    }
    return map;
  }, [kind, discovered, installedThemes]);

  const entries = useMemo(() => {
    const all = result?.entries ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((entry) =>
      `${entry.name} ${entry.description} ${entry.author}`
        .toLowerCase()
        .includes(needle),
    );
  }, [result, query]);

  const installTheme = async (entry: RegistryEntry) => {
    const store = useThemeStore.getState();
    const manifestText = await readEntryAsset(entry, "manifest.json");
    const css = await readEntryAsset(entry, "theme.css");
    if (installedVersions.has(entry.id)) await store.remove(entry.id);
    await store.install(entry.id, manifestText, css);
    await store.apply(entry.id);
  };

  const installPlugin = async (entry: RegistryEntry) => {
    const bridge = window.edenwright;
    const files = await downloadPluginFiles(entry);
    const dir = `.eden/plugins/${files.id}`;
    if (!(await bridge.pluginfs.exists(dir))) await bridge.pluginfs.mkdir(dir);
    await bridge.pluginfs.write(`${dir}/manifest.json`, files.manifestText);
    await bridge.pluginfs.write(`${dir}/main.js`, files.mainJs);
    if (files.stylesCss !== null) {
      await bridge.pluginfs.write(`${dir}/styles.css`, files.stylesCss);
    }
    // Enable (trust dialog fires inside the runtime on first load, §9.3).
    const state = await bridge.eden.state();
    if (state.current) {
      const settings = state.current.settings;
      if (!settings.plugins.enabled.includes(files.id)) {
        await bridge.eden.saveSettings({
          ...settings,
          plugins: {
            ...settings.plugins,
            enabled: [...settings.plugins.enabled, files.id],
          },
        });
      }
    }
    await pluginRuntime.syncFromSettings();
  };

  const install = async (entry: RegistryEntry) => {
    setBusyId(entry.id);
    try {
      if (kind === "themes") await installTheme(entry);
      else await installPlugin(entry);
      toast(`${entry.name} installed.`);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : `Could not install ${entry.name}.`,
        "warn",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="ew-community">
      <div className="ew-community__header">
        <Sprout size={15} aria-hidden />
        <h3>Community {kind}</h3>
      </div>

      {result?.source === "fixture" ? (
        <p className="ew-community__offline">
          <CloudOff size={13} aria-hidden /> Offline — showing the bundled list.
          Installs need a connection.
        </p>
      ) : null}

      <input
        type="search"
        className="ew-community__search"
        placeholder={`Search community ${kind}…`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {result === null ? (
        <p className="ew-community__loading">Fetching the community shelf…</p>
      ) : entries.length === 0 ? (
        <p className="ew-community__empty">
          Nothing matches “{query}” yet — the garden is young.
        </p>
      ) : (
        <ul className="ew-community__list">
          {entries.map((entry) => {
            const installedVersion = installedVersions.get(entry.id);
            const isUpdate =
              installedVersion !== undefined &&
              compareVersions(entry.version, installedVersion) > 0;
            return (
              <li key={entry.id} className="ew-community__card">
                <div className="ew-community__card-top">
                  <span className="ew-community__name">{entry.name}</span>
                  <span className="ew-community__version">
                    v{entry.version}
                  </span>
                </div>
                <p className="ew-community__description">{entry.description}</p>
                {entry.screenshots?.length ? (
                  <div className="ew-community__shots">
                    {entry.screenshots.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt={`${entry.name} screenshot`}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="ew-community__meta">
                  <span className="ew-community__author">{entry.author}</span>
                  {installedVersion !== undefined && !isUpdate ? (
                    <span className="ew-community__installed">Installed</span>
                  ) : (
                    <button
                      type="button"
                      className="ew-community__install"
                      disabled={busyId !== null}
                      onClick={() => void install(entry)}
                    >
                      {isUpdate ? (
                        <>
                          <RefreshCw size={12} aria-hidden />
                          {busyId === entry.id ? "Updating…" : "Update"}
                        </>
                      ) : (
                        <>
                          <Download size={12} aria-hidden />
                          {busyId === entry.id ? "Installing…" : "Install"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
