import { useState } from "react";

import { countWords, kindFromPath } from "@edenwright/core";

import { Button } from "@edenwright/ui";

import { ipcErrorMessage, useAppStore } from "../store";
import { GoalsSection, ScheduleSection } from "./goals-section";
import { HistorySection } from "./history-section";
import { OutlineSection } from "./outline-section";
import "./details-panel.css";

/** Right panel: facts about the open file, plus rename/delete. */
export function DetailsPanel() {
  const openFile = useAppStore((state) => state.openFile);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const closeFile = useAppStore((state) => state.closeFile);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const toast = useAppStore((state) => state.toast);
  const edenManifest = useAppStore((state) => state.edenManifest);
  const editSource = useAppStore((state) => state.editSource);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

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
  // The outline belongs to prose files — a codex sheet is form, not text.
  const showOutline =
    openFile.path.toLowerCase().endsWith(".md") &&
    (kindFromPath(openFile.path) !== "codex" || editSource);

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

      {showOutline ? <OutlineSection /> : null}

      {edenManifest ? <GoalsSection manifest={edenManifest} /> : null}

      {edenManifest?.preset === "serial" ? (
        <ScheduleSection manifest={edenManifest} />
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
