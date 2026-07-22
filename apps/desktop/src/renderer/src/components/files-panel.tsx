import { useState } from "react";

import { kindFromPath, projectNameFromPath } from "@edenwright/core";
import { ArrowLeftRight, BookPlus, FilePlus, FolderPlus } from "lucide-react";

import { BloomIcon, Icon } from "@edenwright/ui";

import { newFileTemplate } from "../lib/file-template";
import { ipcErrorMessage, useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { FileTree } from "./file-tree";
import "./files-panel.css";

/** Left panel: eden identity, file creation, the tree, index progress. */
export function FilesPanel() {
  const edenState = useAppStore((state) => state.edenState);
  const indexing = useAppStore((state) => state.indexing);
  const openFile = useAppStore((state) => state.openFile);
  const closeEden = useAppStore((state) => state.closeEden);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const toast = useAppStore((state) => state.toast);

  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [name, setName] = useState("");
  const projects = useAppStore((state) => state.projects);
  const worlds = useAppStore((state) => state.worlds);
  const setNewProjectOpen = useAppStore((state) => state.setNewProjectOpen);
  const presets = usePluginStore((state) => state.presets);

  const edenName = edenState?.current?.info.name ?? "eden";
  const creationDir = useAppStore((state) => state.creationDir);
  // New things grow in the last-clicked tree folder, else next to the open
  // file, else at Projects/ by default.
  const targetDir =
    creationDir ??
    (openFile
      ? openFile.path.slice(0, openFile.path.lastIndexOf("/"))
      : "Projects");

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
    const relPath =
      mode === "file" && !trimmed.toLowerCase().endsWith(".md")
        ? `${targetDir}/${trimmed}.md`
        : `${targetDir}/${trimmed}`;
    try {
      if (mode === "file") {
        // Stamp the preset's default fields when inside a project (§6).
        const projectName = projectNameFromPath(relPath);
        const project = projects.find((item) => item.name === projectName);
        const preset = presets.find((item) => item.id === project?.preset);
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
      <div className="files-panel__eden">
        <BloomIcon size={16} halo={false} />
        <span className="files-panel__eden-name" title={edenName}>
          {edenName}
        </span>
        <button
          type="button"
          className="files-panel__icon-button"
          title="Switch eden"
          onClick={() => void closeEden()}
        >
          <Icon icon={ArrowLeftRight} size={14} />
        </button>
      </div>

      <div className="files-panel__toolbar">
        <span className="files-panel__label">Files</span>
        <button
          type="button"
          className="files-panel__icon-button"
          title="New project…"
          onClick={() => setNewProjectOpen(true)}
        >
          <Icon icon={BookPlus} size={15} />
        </button>
        <button
          type="button"
          className="files-panel__icon-button"
          title={`New note in ${targetDir}`}
          onClick={() => setCreating("file")}
        >
          <Icon icon={FilePlus} size={15} />
        </button>
        <button
          type="button"
          className="files-panel__icon-button"
          title={`New folder in ${targetDir}`}
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
        <FileTree projects={projects} worlds={worlds} presets={presets} />
      </div>

      {indexing ? (
        <div className="files-panel__indexing">
          Indexing {indexing.done}/{indexing.total}…
        </div>
      ) : null}
    </div>
  );
}
