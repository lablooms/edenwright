import { useState } from "react";

import { kindFromPath } from "@edenwright/core";
import { FilePlus, FolderPlus } from "lucide-react";

import { Icon } from "@edenwright/ui";

import { newFileTemplate } from "../lib/file-template";
import { ipcErrorMessage, useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { FileTree } from "./file-tree";
import "./files-panel.css";

/** Left panel: file creation, the tree, index progress. */
export function FilesPanel() {
  const edenManifest = useAppStore((state) => state.edenManifest);
  const indexing = useAppStore((state) => state.indexing);
  const openFile = useAppStore((state) => state.openFile);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const toast = useAppStore((state) => state.toast);

  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [name, setName] = useState("");
  const presets = usePluginStore((state) => state.presets);

  // The eden name lives in the title-bar switcher — the one canonical spot.
  const creationDir = useAppStore((state) => state.creationDir);
  // New things grow in the last-clicked tree folder, else next to the open
  // file, else at the eden root.
  const targetDir =
    creationDir ??
    (openFile ? openFile.path.slice(0, openFile.path.lastIndexOf("/")) : null);

  const submit = async () => {
    const trimmed = name.trim();
    const mode = creating;
    setCreating(null);
    setName("");
    if (!trimmed || !mode) return;
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      toast("One name at a time — no slashes.", "warn");
      return;
    }
    const fileName =
      mode === "file" && !trimmed.toLowerCase().endsWith(".md")
        ? `${trimmed}.md`
        : trimmed;
    const relPath = targetDir ? `${targetDir}/${fileName}` : fileName;
    try {
      if (mode === "file") {
        // Stamp the eden preset's default fields on new documents (§6).
        const preset = presets.find((item) => item.id === edenManifest?.preset);
        const template = newFileTemplate({
          kind: kindFromPath(relPath),
          name: trimmed.replace(/\.md$/i, ""),
          preset: preset ?? null,
        });
        await window.edenwright.files.write(relPath, template, null);
        await openFileAt(relPath);
      } else {
        await window.edenwright.files.createFolder(relPath);
      }
      await refreshTree();
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  return (
    <div className="files-panel">
      <div className="files-panel__toolbar">
        <span className="files-panel__label">Files</span>
        <button
          type="button"
          className="files-panel__icon-button"
          title={
            targetDir ? `New note in ${targetDir}` : "New note at the root"
          }
          onClick={() => setCreating("file")}
        >
          <Icon icon={FilePlus} size={15} />
        </button>
        <button
          type="button"
          className="files-panel__icon-button"
          title={
            targetDir ? `New folder in ${targetDir}` : "New folder at the root"
          }
          onClick={() => setCreating("folder")}
        >
          <Icon icon={FolderPlus} size={15} />
        </button>
      </div>

      {creating ? (
        <input
          className="files-panel__create-input"
          autoFocus
          placeholder={
            creating === "file" ? "New note name…" : "New folder name…"
          }
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
            if (event.key === "Escape") {
              setCreating(null);
              setName("");
            }
          }}
          onBlur={() => {
            setCreating(null);
            setName("");
          }}
        />
      ) : null}

      <div className="files-panel__tree">
        <FileTree />
      </div>

      {indexing ? (
        <div className="files-panel__indexing">
          Indexing {indexing.done}/{indexing.total}…
        </div>
      ) : null}
    </div>
  );
}
