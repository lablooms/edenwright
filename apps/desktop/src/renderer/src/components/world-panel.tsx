import { useEffect, useMemo, useState } from "react";

import { BUILTIN_ENTITY_TYPES } from "@edenwright/core";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Map as MapIcon,
  NotebookPen,
} from "lucide-react";

import { Icon } from "@edenwright/ui";

import type { EntitySummary, TreeNode } from "../../../preload/api";
import { lucideByName } from "../lib/icons";
import { ipcErrorMessage, useAppStore } from "../store";
import "./world-panel.css";

/** One eden = one world = one codex: entities live here, nowhere else. */
const CODEX_DIR = "world/codex";
const NOTES_DIR = "world/notes";
const MAPS_DIR = "world/maps";

/** What each type is for, in writer words — the empty state teaches (§7.4). */
const TYPE_HINTS: Record<string, { plural: string; hint: string }> = {
  character: { plural: "Characters", hint: "the people in your story" },
  place: { plural: "Places", hint: "where things happen" },
  item: { plural: "Items", hint: "things that matter" },
  faction: { plural: "Factions", hint: "groups and sides" },
  lore: { plural: "Lore", hint: "the rules and history" },
};

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = node.children ? findNode(node.children, path) : undefined;
    if (found) return found;
  }
  return undefined;
}

function countFiles(node: TreeNode | undefined): number {
  if (!node) return 0;
  if (node.kind === "file") return 1;
  return (node.children ?? []).reduce(
    (sum, child) => sum + countFiles(child),
    0,
  );
}

/**
 * The World tab: the eden's worldbuilding hub. Entities up top, shortcuts
 * to world notes & maps in the middle, the story timeline at the bottom.
 */
export function WorldPanel() {
  const openFileAt = useAppStore((state) => state.openFileAt);
  const openFile = useAppStore((state) => state.openFile);
  const tree = useAppStore((state) => state.tree);
  const toast = useAppStore((state) => state.toast);
  const setSideView = useAppStore((state) => state.setSideView);
  const setMainView = useAppStore((state) => state.setMainView);

  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [entityName, setEntityName] = useState("");
  const [creatingDoc, setCreatingDoc] = useState<"notes" | "maps" | null>(null);
  const [docName, setDocName] = useState("");
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const refresh = () => {
    void window.edenwright.query.entities().then(setEntities);
  };
  // Follow the tree: files created/moved elsewhere show up here live.
  useEffect(refresh, [openFile?.path, tree]);

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const map = new Map<string, EntitySummary[]>();
    for (const entity of entities) {
      if (
        needle &&
        !entity.name.toLowerCase().includes(needle) &&
        !entity.aliases.some((alias) => alias.toLowerCase().includes(needle))
      ) {
        continue;
      }
      const type = entity.entityType ?? "character";
      const list = map.get(type) ?? [];
      list.push(entity);
      map.set(type, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entities, filter]);

  const notesCount = useMemo(
    () => countFiles(findNode(tree, NOTES_DIR)),
    [tree],
  );
  const mapsCount = useMemo(() => countFiles(findNode(tree, MAPS_DIR)), [tree]);

  const toggleGroup = (type: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const createEntity = async () => {
    const name = entityName.trim();
    const typeDef = BUILTIN_ENTITY_TYPES.find(
      (item) => item.type === creatingType,
    );
    if (!name || !typeDef) return;
    const fileName = `${CODEX_DIR}/${name}.md`;
    const id = `ent_${Math.random().toString(36).slice(2, 10)}`;
    const text = `---\nid: ${id}\ntype: ${typeDef.type}\nname: ${JSON.stringify(name)}\naliases: []\nfields: {}\n---\n\n`;
    try {
      await window.edenwright.files.write(fileName, text, null);
      setCreatingType(null);
      setEntityName("");
      refresh();
      await openFileAt(fileName);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  /** Jump to the folder in Files, expanded so its contents are visible. */
  const revealFolder = (path: string) => {
    const { expanded, toggleExpanded } = useAppStore.getState();
    for (const dir of ["world", path]) {
      if (!expanded.has(dir)) toggleExpanded(dir);
    }
    setSideView("files");
  };

  const createDoc = async () => {
    const name = docName.trim();
    if (!name || !creatingDoc) return;
    const dir = creatingDoc === "notes" ? NOTES_DIR : MAPS_DIR;
    const fileName = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
    const path = `${dir}/${fileName}`;
    try {
      await window.edenwright.files.write(path, `# ${name}\n\n`, null);
      setCreatingDoc(null);
      setDocName("");
      await openFileAt(path);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const shortcutRow = (kind: "notes" | "maps") => {
    const isNotes = kind === "notes";
    const count = isNotes ? notesCount : mapsCount;
    return (
      <button
        type="button"
        className="world-panel__shortcut"
        onClick={() =>
          count > 0
            ? revealFolder(isNotes ? NOTES_DIR : MAPS_DIR)
            : setCreatingDoc(kind)
        }
      >
        <Icon icon={isNotes ? NotebookPen : MapIcon} size={15} />
        <span className="world-panel__shortcut-name">
          {isNotes ? "World notes" : "Maps"}
        </span>
        <span className="world-panel__shortcut-count">
          {count === 0 ? "make the first one" : `${count}`}
        </span>
      </button>
    );
  };

  return (
    <div className="world-panel">
      <div className="world-panel__header">
        <span className="world-panel__label">World</span>
      </div>

      <div className="world-panel__scroll">
        <section className="world-panel__section">
          <h3 className="world-panel__section-title">Entities</h3>
          <div className="world-panel__create-row">
            {BUILTIN_ENTITY_TYPES.map((typeDef) => (
              <button
                key={typeDef.type}
                type="button"
                className="world-panel__create-type"
                data-active={creatingType === typeDef.type || undefined}
                title={`New ${typeDef.label.toLowerCase()}`}
                onClick={() => {
                  setCreatingType((current) =>
                    current === typeDef.type ? null : typeDef.type,
                  );
                  setEntityName("");
                }}
              >
                <Icon icon={lucideByName(typeDef.icon)} size={13} />
                {typeDef.label}
              </button>
            ))}
          </div>

          {creatingType ? (
            <input
              className="world-panel__create-input"
              placeholder={`Name your ${BUILTIN_ENTITY_TYPES.find((item) => item.type === creatingType)?.label.toLowerCase() ?? "entity"}…`}
              value={entityName}
              autoFocus
              onChange={(event) => setEntityName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createEntity();
                if (event.key === "Escape") setCreatingType(null);
              }}
            />
          ) : null}

          <input
            type="search"
            className="world-panel__filter"
            placeholder="Filter entities…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

          <div className="world-panel__list">
            {entities.length === 0 ? (
              <div className="world-panel__empty">
                <p className="world-panel__empty-title">
                  Your world starts here.
                </p>
                <ul className="world-panel__hints">
                  {BUILTIN_ENTITY_TYPES.map((typeDef) => {
                    const hint = TYPE_HINTS[typeDef.type];
                    return (
                      <li key={typeDef.type} className="world-panel__hint-row">
                        <Icon icon={lucideByName(typeDef.icon)} size={13} />
                        <span>
                          <strong>{hint?.plural ?? typeDef.label}</strong>
                          {" — "}
                          {hint?.hint ?? ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {entities.length > 0 && grouped.length === 0 ? (
              <p className="world-panel__no-match">
                Nothing named “{filter}” grows here.
              </p>
            ) : null}
            {grouped.map(([type, items]) => {
              const typeDef = BUILTIN_ENTITY_TYPES.find(
                (item) => item.type === type,
              );
              const isCollapsed = collapsed.has(type);
              return (
                <section key={type} className="world-panel__group">
                  <button
                    type="button"
                    className="world-panel__group-title"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleGroup(type)}
                  >
                    <Icon
                      icon={isCollapsed ? ChevronRight : ChevronDown}
                      size={12}
                    />
                    <Icon icon={lucideByName(typeDef?.icon)} size={13} />
                    {typeDef?.label ?? type}
                    <span className="world-panel__count">{items.length}</span>
                  </button>
                  {isCollapsed
                    ? null
                    : items.map((entity) => (
                        <button
                          key={entity.path}
                          type="button"
                          className="world-panel__entity"
                          data-active={
                            openFile?.path === entity.path || undefined
                          }
                          onClick={() => void openFileAt(entity.path)}
                        >
                          <span className="world-panel__entity-name">
                            {entity.name}
                          </span>
                          {entity.aliases.length > 0 ? (
                            <span className="world-panel__entity-alias">
                              {entity.aliases[0]}
                            </span>
                          ) : null}
                        </button>
                      ))}
                </section>
              );
            })}
          </div>
        </section>

        <section className="world-panel__section">
          <h3 className="world-panel__section-title">World notes &amp; maps</h3>
          {shortcutRow("notes")}
          {shortcutRow("maps")}
          {creatingDoc ? (
            <input
              className="world-panel__create-input"
              placeholder={
                creatingDoc === "notes"
                  ? "Name your first world note…"
                  : "Name your first map…"
              }
              value={docName}
              autoFocus
              onChange={(event) => setDocName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createDoc();
                if (event.key === "Escape") setCreatingDoc(null);
              }}
            />
          ) : null}
        </section>

        <section className="world-panel__section">
          <h3 className="world-panel__section-title">Timeline</h3>
          <button
            type="button"
            className="world-panel__shortcut"
            onClick={() => setMainView("timeline")}
          >
            <Icon icon={CalendarClock} size={15} />
            <span className="world-panel__shortcut-name">Story timeline</span>
          </button>
          <p className="world-panel__hint">
            See your events in story-time order.
          </p>
        </section>
      </div>
    </div>
  );
}
