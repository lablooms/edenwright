import { useState } from "react";

import type { PresetDefinition } from "@edenwright/plugin-api";

import type { ProjectInfo, TreeNode, WorldInfo } from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";
import "./file-tree.css";

interface FileTreeProps {
  projects: ProjectInfo[];
  worlds: WorldInfo[];
  presets: PresetDefinition[];
}

interface DragState {
  dragging: string | null;
  overDir: string | null;
}

/** The eden's file tree: Projects/ and Worlds/, directories first. */
export function FileTree({ projects, worlds, presets }: FileTreeProps) {
  const tree = useAppStore((state) => state.tree);
  const [drag, setDrag] = useState<DragState>({
    dragging: null,
    overDir: null,
  });
  return (
    <div className="file-tree" role="tree" aria-label="Files">
      {tree.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          projects={projects}
          worlds={worlds}
          presets={presets}
          drag={drag}
          setDrag={setDrag}
        />
      ))}
      {tree.length === 0 ? (
        <p className="file-tree__empty">
          Nothing planted yet — make a file with the + button above.
        </p>
      ) : null}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  projects,
  worlds,
  presets,
  drag,
  setDrag,
}: {
  node: TreeNode;
  depth: number;
  projects: ProjectInfo[];
  worlds: WorldInfo[];
  presets: PresetDefinition[];
  drag: DragState;
  setDrag: (drag: DragState) => void;
}) {
  const expanded = useAppStore((state) => state.expanded);
  const toggleExpanded = useAppStore((state) => state.toggleExpanded);
  const setCreationDir = useAppStore((state) => state.setCreationDir);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const toast = useAppStore((state) => state.toast);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const openFile = useAppStore((state) => state.openFile);
  const [hovered, setHovered] = useState(false);

  // Outliner restructure (§7.7): drag a file onto a directory to move it.
  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    // Drop target tracked locally — setState here is for the highlight,
    // the up-handler reads this (never a stale closure).
    let overDir: string | null = null;
    const onMove = (move: PointerEvent) => {
      if (
        !moved &&
        Math.abs(move.clientX - start.x) + Math.abs(move.clientY - start.y) > 6
      ) {
        moved = true;
        setDrag({ dragging: node.path, overDir: null });
      }
      if (moved) {
        const element = document.elementFromPoint(move.clientX, move.clientY);
        const dir = element?.closest("[data-dir-path]");
        overDir = dir?.getAttribute("data-dir-path") ?? null;
        setDrag({ dragging: node.path, overDir });
      }
    };
    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag({ dragging: null, overDir: null });
      if (!moved || !overDir) return;
      const parent = node.path.slice(0, node.path.lastIndexOf("/"));
      if (overDir === parent || overDir === node.path) return;
      if (node.path.startsWith(`${overDir}/`)) return; // no self-nesting
      const target = `${overDir}/${node.name}`;
      try {
        await window.edenwright.files.rename(node.path, target);
        if (openFile?.path === node.path) {
          await openFileAt(target);
        }
        await refreshTree();
        toast(`Moved to ${overDir}.`);
      } catch (error) {
        toast(ipcErrorMessage(error), "warn");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const isOpen = expanded.has(node.path);
  const isActive = openFile?.path === node.path;

  // A project folder gets its preset as a badge; a world gets "World".
  const project =
    node.kind === "directory" && node.path.startsWith("Projects/")
      ? projects.find((item) => `Projects/${item.name}` === node.path)
      : undefined;
  const world =
    node.kind === "directory" && node.path.startsWith("Worlds/")
      ? worlds.find((item) => `Worlds/${item.name}` === node.path)
      : undefined;
  const presetName = project
    ? (presets.find((preset) => preset.id === project.preset)?.name ??
      project.preset)
    : world
      ? "World"
      : undefined;

  if (node.kind === "directory") {
    return (
      <div role="treeitem" aria-expanded={isOpen}>
        <button
          type="button"
          className="file-tree__row file-tree__row--dir"
          data-dir-path={node.path}
          data-drop-target={drag.overDir === node.path || undefined}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => {
            toggleExpanded(node.path);
            setCreationDir(node.path);
          }}
        >
          <span className="file-tree__caret">{isOpen ? "▾" : "▸"}</span>
          <span className="file-tree__name">{node.name}</span>
          {presetName ? (
            <span className="file-tree__badge">{presetName}</span>
          ) : null}
        </button>
        {isOpen
          ? node.children?.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                projects={projects}
                worlds={worlds}
                presets={presets}
                drag={drag}
                setDrag={setDrag}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="treeitem"
      className="file-tree__row file-tree__row--file"
      data-active={isActive || undefined}
      data-dragging={drag.dragging === node.path || undefined}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => void openFileAt(node.path)}
      onPointerDown={startDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={hovered ? node.path : undefined}
    >
      <span className="file-tree__caret" aria-hidden />
      <span className="file-tree__name">{node.name}</span>
    </button>
  );
}
