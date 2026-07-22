import { useState } from "react";

import { countWords, projectNameFromPath } from "@edenwright/core";
import { X } from "lucide-react";

import { Button, Icon } from "@edenwright/ui";

import { ipcErrorMessage, useAppStore } from "../store";
import { GoalsSection, ScheduleSection } from "./goals-section";
import { HistorySection } from "./history-section";
import "./details-panel.css";

/** Right panel: facts about the open file, plus rename/delete. */
export function DetailsPanel() {
  const openFile = useAppStore((state) => state.openFile);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const closeFile = useAppStore((state) => state.closeFile);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const toast = useAppStore((state) => state.toast);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const projects = useAppStore((state) => state.projects);
  const worlds = useAppStore((state) => state.worlds);
  const refreshProjects = useAppStore((state) => state.refreshProjects);

  if (!openFile) {
    return (
      <div className="details-panel">
        <h2 className="details-panel__heading">Details</h2>
        <p className="details-panel__body">
          Select something and its details will bloom here.
        </p>
      </div>
    );
  }

  const dir = openFile.path.slice(0, openFile.path.lastIndexOf("/"));
  const fileName = openFile.path.slice(openFile.path.lastIndexOf("/") + 1);
  const words = countWords(openFile.content);

  const projectName = projectNameFromPath(openFile.path);
  const project = projects.find((item) => item.name === projectName);
  const linkedWorlds = project?.linkedWorlds ?? [];

  const setLinkedWorlds = async (next: string[]) => {
    if (!project) return;
    try {
      await window.edenwright.projects.update(project.name, {
        linkedWorlds: next,
      });
      await refreshProjects();
      toast(
        next.length > linkedWorlds.length
          ? "World linked — its cast is in reach now."
          : "World unlinked.",
      );
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const submitRename = async () => {
    const trimmed = newName.trim();
    setRenaming(false);
    if (!trimmed || trimmed === fileName) return;
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      toast("Names can't contain slashes.", "warn");
      return;
    }
    const target = `${dir}/${trimmed}`;
    try {
      await window.edenwright.files.rename(openFile.path, target);
      await openFileAt(target);
      await refreshTree();
      toast("Renamed.");
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete "${openFile.path}"? The file leaves your disk — snapshots may still hold a copy.`,
      )
    ) {
      return;
    }
    try {
      closeFile();
      await window.edenwright.files.delete(openFile.path);
      await refreshTree();
      toast("Deleted.");
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  return (
    <div className="details-panel">
      <h2 className="details-panel__heading">Details</h2>
      <dl className="details-panel__facts">
        <dt>File</dt>
        <dd title={openFile.path}>{fileName}</dd>
        <dt>Folder</dt>
        <dd>{dir}</dd>
        <dt>Words</dt>
        <dd>{words.toLocaleString()}</dd>
      </dl>

      {project ? <GoalsSection project={project} /> : null}

      {project?.preset === "serial" ? (
        <ScheduleSection project={project} />
      ) : null}

      {project ? (
        <section className="details-panel__world">
          <h3 className="details-panel__heading">Linked worlds</h3>
          <div className="details-panel__world-chips">
            {linkedWorlds.map((world) => (
              <span key={world} className="details-panel__world-chip">
                {world}
                <button
                  type="button"
                  title={`Unlink ${world}`}
                  onClick={() =>
                    void setLinkedWorlds(
                      linkedWorlds.filter((item) => item !== world),
                    )
                  }
                >
                  <Icon icon={X} size={11} />
                </button>
              </span>
            ))}
          </div>
          {worlds.filter((world) => !linkedWorlds.includes(world.name)).length >
          0 ? (
            <select
              className="details-panel__world-select"
              value=""
              onChange={(event) => {
                const world = event.target.value;
                if (world) void setLinkedWorlds([...linkedWorlds, world]);
              }}
            >
              <option value="">Link a world…</option>
              {worlds
                .filter((world) => !linkedWorlds.includes(world.name))
                .map((world) => (
                  <option key={world.name} value={world.name}>
                    {world.name}
                  </option>
                ))}
            </select>
          ) : null}
          {linkedWorlds.length === 0 ? (
            <p className="details-panel__body">
              No linked worlds — link one and its cast joins this project's
              @-completion and searches.
            </p>
          ) : null}
        </section>
      ) : null}

      <HistorySection />

      {renaming ? (
        <input
          className="details-panel__rename-input"
          autoFocus
          defaultValue={fileName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submitRename();
            if (event.key === "Escape") setRenaming(false);
          }}
          onBlur={() => setRenaming(false)}
        />
      ) : (
        <div className="details-panel__actions">
          <Button
            variant="ghost"
            onClick={() => {
              setNewName(fileName);
              setRenaming(true);
            }}
          >
            Rename
          </Button>
          <Button variant="ghost" onClick={() => void onDelete()}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
