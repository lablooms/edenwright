import { useMemo, useState } from "react";

import { Button, Icon } from "@edenwright/ui";

import { ipcErrorMessage, useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { lucideByName } from "../lib/icons";
import "./new-project-modal.css";

/** Medium groups in gallery order (SPEC v2 §6). */
const MEDIUM_ORDER: [string, string][] = [
  ["prose", "Prose"],
  ["screenplay", "Screenplay"],
  ["comic", "Comic"],
  ["interactive", "Interactive"],
  ["world", "World"],
];

/**
 * New-project flow (SPEC v2 §6): one gallery of presets grouped by medium,
 * then a name. No engine step — presets ARE the medium.
 */
export function NewProjectModal() {
  const newProjectOpen = useAppStore((state) => state.newProjectOpen);
  const setNewProjectOpen = useAppStore((state) => state.setNewProjectOpen);
  const refreshProjects = useAppStore((state) => state.refreshProjects);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const toast = useAppStore((state) => state.toast);
  const presets = usePluginStore((state) => state.presets);

  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const preset = useMemo(
    () => presets.find((candidate) => candidate.id === presetId) ?? null,
    [presets, presetId],
  );
  const grouped = useMemo(
    () =>
      MEDIUM_ORDER.map(([medium, label]) => ({
        medium,
        label,
        presets: presets.filter((candidate) => candidate.medium === medium),
      })).filter((group) => group.presets.length > 0),
    [presets],
  );

  if (!newProjectOpen) return null;

  const close = () => {
    setNewProjectOpen(false);
    setPresetId(null);
    setName("");
    setBusy(false);
  };

  const create = async () => {
    if (!preset || name.trim().length === 0 || busy) return;
    setBusy(true);
    try {
      if (preset.home === "worlds") {
        await window.edenwright.worlds.create(name.trim());
        await useAppStore.getState().refreshWorlds();
      } else {
        await window.edenwright.projects.create({
          name: name.trim(),
          preset: preset.id,
          medium: preset.medium,
          scaffold: preset.scaffold,
        });
        await refreshProjects();
      }
      await refreshTree();
      toast(`${name.trim()} is planted. First file, whenever you're ready.`);
      close();
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
      setBusy(false);
    }
  };

  return (
    <div
      className="new-project-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="new-project" role="dialog" aria-label="New project">
        <h2 className="new-project__title">New project</h2>

        <div className="new-project__gallery">
          {grouped.map((group) => (
            <div className="new-project__section" key={group.medium}>
              <span className="new-project__label">{group.label}</span>
              <div className="new-project__engines">
                {group.presets.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="new-project__engine"
                    data-active={presetId === candidate.id || undefined}
                    onClick={() => setPresetId(candidate.id)}
                  >
                    <Icon icon={lucideByName(candidate.icon)} size={18} />
                    <span className="new-project__engine-name">
                      {candidate.name}
                    </span>
                    <span className="new-project__engine-desc">
                      {candidate.description ?? ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="new-project__section">
          <span className="new-project__label">Name</span>
          <input
            className="new-project__name"
            placeholder="Hollow Crown"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
              if (event.key === "Escape") close();
            }}
          />
        </div>

        <div className="new-project__actions">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!presetId || name.trim().length === 0 || busy}
            onClick={() => void create()}
          >
            {busy ? "Planting…" : "Create project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
