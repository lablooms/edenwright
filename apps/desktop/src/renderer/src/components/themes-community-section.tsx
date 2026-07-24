import { useEffect, useMemo, useState } from "react";
import { CloudOff, Download, RefreshCw, Sprout } from "lucide-react";

import { useAppStore } from "../store";
import { useThemeStore } from "../themes/theme-store";
import {
  compareVersions,
  fetchThemeRegistry,
  readThemeAsset,
  type ThemeRegistryEntry,
  type ThemeRegistryResult,
} from "../themes/themes-registry";

import "./themes-community-section.css";

/**
 * The community themes shelf (SPEC §9.4): browse, search, install, update,
 * rendered inside the Themes panel. Offline = the bundled fixture with a
 * quiet hint; installs then fail soft. (R5: plugins no longer have a
 * community shelf — community plugins are deferred to post-beta.)
 */
export function ThemesCommunitySection() {
  const toast = useAppStore((state) => state.toast);
  const installedThemes = useThemeStore((state) => state.installed);

  const [result, setResult] = useState<ThemeRegistryResult | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchThemeRegistry().then((registry) => {
      if (!cancelled) setResult(registry);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const installedVersions = useMemo(() => {
    const map = new Map<string, string>();
    for (const theme of installedThemes) {
      map.set(theme.manifest.id, theme.manifest.version);
    }
    return map;
  }, [installedThemes]);

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

  const install = async (entry: ThemeRegistryEntry) => {
    setBusyId(entry.id);
    try {
      const store = useThemeStore.getState();
      const manifestText = await readThemeAsset(entry, "manifest.json");
      const css = await readThemeAsset(entry, "theme.css");
      if (installedVersions.has(entry.id)) await store.remove(entry.id);
      await store.install(entry.id, manifestText, css);
      await store.apply(entry.id);
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
        <h3>Community themes</h3>
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
        placeholder="Search community themes…"
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
