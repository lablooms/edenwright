import { useState } from "react";

import { BloomIcon, Button, Icon } from "@edenwright/ui";
import { FolderOpen, Leaf, Plus, Sprout, X } from "lucide-react";

import type { RecentEden } from "../../../preload/api";
import { lucideByName } from "../lib/icons";
import { usePluginStore } from "../plugins/plugin-store";
import { useAppStore } from "../store";
import "./launcher.css";

/**
 * "Today", "Yesterday", or a short date — recents should read like memory,
 * not like a log file. Invalid/missing dates render as nothing.
 */
function friendlyDate(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    // The year only matters once it's not this one.
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Long paths collapse in the middle so both ends stay recognizable. */
function ellipsizeMiddle(path: string, max = 56): string {
  if (path.length <= max) return path;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${path.slice(0, head)}…${path.slice(path.length - tail)}`;
}

/**
 * The launcher (SPEC §3 home): brand on the left, the three ways into an
 * eden on the right — recents, create, open. Shown whenever no eden is open.
 */
export function Launcher() {
  const edenState = useAppStore((state) => state.edenState);
  const openError = useAppStore((state) => state.edenOpenError);
  const createEden = useAppStore((state) => state.createEden);
  const openEden = useAppStore((state) => state.openEden);
  const removeRecentEden = useAppStore((state) => state.removeRecentEden);
  // Built-in presets are bundled data (SPEC v2 §6) — no bridge needed.
  const presets = usePluginStore((state) => state.presets);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recents = edenState?.recents ?? [];

  const iconFor = (recent: RecentEden) => {
    const preset = presets.find((candidate) => candidate.id === recent.preset);
    // Unknown preset (older entry, uninstalled plugin preset): a plain leaf.
    return preset ? lucideByName(preset.icon) : Leaf;
  };

  const pickParent = async () => {
    const chosen = await window.edenwright.eden.pickDirectory(
      "Where should your eden live?",
    );
    if (chosen) setParentDir(chosen);
  };

  const onCreate = async () => {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!parentDir || !preset || name.trim().length === 0 || busy) return;
    setBusy(true);
    const created = await createEden(parentDir, name, {
      preset: preset.id,
      medium: preset.medium,
      scaffold: preset.scaffold,
      description: preset.description,
    });
    setBusy(false);
    // A failed create keeps the form filled — nothing typed is lost.
    if (created) {
      setCreateOpen(false);
      setName("");
      setParentDir(null);
    }
  };

  const browseOpen = async () => {
    const chosen = await window.edenwright.eden.pickDirectory("Open an eden");
    if (chosen) await openEden(chosen);
  };

  return (
    <div className="launcher">
      <aside className="launcher__brand">
        <BloomIcon size={88} />
        <h1 className="launcher__wordmark">Edenwright</h1>
        <p className="launcher__tagline">Every story needs a garden.</p>
      </aside>

      <div className="launcher__main">
        <div className="launcher__sections">
          <section className="launcher__section">
            <h2 className="launcher__heading">Your edens</h2>
            {openError ? (
              <p className="launcher__open-error" role="alert">
                {openError}
              </p>
            ) : null}
            {recents.length > 0 ? (
              <ul className="launcher__recents">
                {recents.map((recent) => {
                  const RecentIcon = iconFor(recent);
                  const opened = recent.lastOpenedAt
                    ? friendlyDate(recent.lastOpenedAt)
                    : "";
                  return (
                    <li key={recent.path} className="launcher__recent-row">
                      <button
                        type="button"
                        className="launcher__recent"
                        onClick={() => void openEden(recent.path)}
                      >
                        <span className="launcher__recent-icon">
                          <Icon icon={RecentIcon} size={18} />
                        </span>
                        <span className="launcher__recent-text">
                          <span className="launcher__recent-name">
                            {recent.name}
                          </span>
                          <span
                            className="launcher__recent-path"
                            title={recent.path}
                          >
                            {ellipsizeMiddle(recent.path)}
                          </span>
                        </span>
                        {opened ? (
                          <span className="launcher__recent-date">
                            {opened}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="launcher__recent-remove"
                        title="Remove from list — the folder stays on disk"
                        aria-label={`Remove ${recent.name} from the list`}
                        onClick={() => void removeRecentEden(recent.path)}
                      >
                        <Icon icon={X} size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="launcher__empty-recents">
                <Icon icon={Sprout} size={20} />
                <p>No edens yet — every story starts somewhere.</p>
              </div>
            )}
          </section>

          <section className="launcher__section">
            <div className="launcher__section-head">
              <h2 className="launcher__heading">Create a new eden</h2>
              {!createOpen ? (
                <Button variant="ghost" onClick={() => setCreateOpen(true)}>
                  <Plus size={16} /> New eden…
                </Button>
              ) : null}
            </div>
            {createOpen ? (
              <div className="launcher__create">
                <input
                  className="launcher__input"
                  placeholder="Name your eden — e.g. Aster Reach"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <div
                  className="launcher__presets"
                  role="group"
                  aria-label="What kind of story is it?"
                >
                  {presets.map((preset) => {
                    const PresetIcon = lucideByName(preset.icon);
                    const selected = preset.id === presetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`launcher__preset${selected ? " launcher__preset--selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => setPresetId(preset.id)}
                      >
                        <span className="launcher__preset-icon">
                          <Icon icon={PresetIcon} size={18} />
                        </span>
                        <span className="launcher__preset-text">
                          <span className="launcher__preset-name">
                            {preset.name}
                          </span>
                          {preset.description ? (
                            <span className="launcher__preset-desc">
                              {preset.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="launcher__location">
                  <Button variant="ghost" onClick={() => void pickParent()}>
                    <FolderOpen size={16} /> Choose a folder…
                  </Button>
                  <span
                    className="launcher__location-path"
                    title={parentDir ?? undefined}
                  >
                    {parentDir
                      ? ellipsizeMiddle(parentDir)
                      : "No folder chosen yet"}
                  </span>
                </div>
                <div className="launcher__create-actions">
                  <Button
                    disabled={!parentDir || name.trim().length === 0 || busy}
                    onClick={() => void onCreate()}
                  >
                    <Plus size={16} /> Create eden
                  </Button>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="launcher__section">
            <h2 className="launcher__heading">Open an eden folder</h2>
            <p className="launcher__hint">
              An eden is one ordinary folder — plain files you own forever.
            </p>
            <div>
              <Button variant="ghost" onClick={() => void browseOpen()}>
                <FolderOpen size={16} /> Browse for an eden…
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
