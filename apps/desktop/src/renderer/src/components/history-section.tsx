import { useCallback, useEffect, useState } from "react";

import { diffLines } from "@edenwright/core";

import { Button } from "@edenwright/ui";

import type { SnapshotVersionInfo } from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";
import "./history-section.css";

function formatTime(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** History (§7.9): per-file versions from snapshots, diff + one-click restore. */
export function HistorySection() {
  const openFile = useAppStore((state) => state.openFile);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const toast = useAppStore((state) => state.toast);
  const showModal = useAppStore((state) => state.showModal);

  const [versions, setVersions] = useState<SnapshotVersionInfo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [diff, setDiff] = useState<
    { type: "same" | "add" | "remove"; text: string }[] | null
  >(null);

  const load = useCallback(() => {
    if (openFile) {
      void window.edenwright.history.versions(openFile.path).then(setVersions);
    } else {
      setVersions([]);
    }
  }, [openFile]);
  useEffect(load, [load]);

  if (!openFile) return null;

  const openVersion = async (version: SnapshotVersionInfo) => {
    if (expanded === version.name) {
      setExpanded(null);
      setDiff(null);
      return;
    }
    const older = await window.edenwright.history.readVersion(
      version.name,
      openFile.path,
    );
    if (older === null) {
      toast("Couldn't read that version.", "warn");
      return;
    }
    setExpanded(version.name);
    setDiff(diffLines(older, openFile.content));
  };

  const restore = async (version: SnapshotVersionInfo) => {
    const choice = await showModal({
      title: "Restore this version?",
      body: `The current text goes into a fresh snapshot first, then the version from ${formatTime(version.createdAtMs)} is written back. History is never deleted — a restore is just a new write.`,
      actions: [
        { id: "restore", label: "Restore", primary: true },
        { id: "cancel", label: "Cancel" },
      ],
    });
    if (choice !== "restore") return;
    try {
      const result = await window.edenwright.history.restore(
        version.name,
        openFile.path,
      );
      if (result.conflictedPath) {
        toast("Restored beside the disk version as a conflicted copy.", "warn");
      } else {
        toast("Restored. The former text is safe in a fresh snapshot.");
      }
      await openFileAt(openFile.path);
      await refreshTree();
      setExpanded(null);
      setDiff(null);
      load();
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  return (
    <section className="ew-history">
      <h3 className="details-panel__heading">History</h3>
      {versions.length === 0 ? (
        <p className="details-panel__body">
          No snapshots of this file yet — they accumulate as you write (every 10
          minutes and at session end).
        </p>
      ) : (
        <ul className="ew-history__list">
          {versions.map((version) => (
            <li key={version.name} className="ew-history__item">
              <div className="ew-history__row">
                <button
                  type="button"
                  className="ew-history__time"
                  data-active={expanded === version.name || undefined}
                  onClick={() => void openVersion(version)}
                >
                  {formatTime(version.createdAtMs)}
                </button>
                <Button variant="ghost" onClick={() => void restore(version)}>
                  Restore
                </Button>
              </div>
              {expanded === version.name && diff ? (
                <div className="ew-history__diff">
                  {diff.every((line) => line.type === "same") ? (
                    <p className="ew-history__same">
                      Same as the current text.
                    </p>
                  ) : (
                    diff.map((line, index) =>
                      line.type === "same" ? null : (
                        <div
                          key={index}
                          className={`ew-history__line ew-history__line--${line.type}`}
                        >
                          {line.type === "add" ? "+ " : "− "}
                          {line.text || " "}
                        </div>
                      ),
                    )
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
