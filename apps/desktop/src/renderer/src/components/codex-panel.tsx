import { useEffect, useMemo, useState } from "react";

import { BUILTIN_ENTITY_TYPES } from "@edenwright/core";
import { Plus } from "lucide-react";

import { Icon } from "@edenwright/ui";

import type { EntitySummary } from "../../../preload/api";
import { lucideByName } from "../lib/icons";
import { ipcErrorMessage, useAppStore } from "../store";
import "./codex-panel.css";

/** The codex browser (§7.4): every entity in the eden, grouped by type. */
export function CodexPanel() {
  const openFileAt = useAppStore((state) => state.openFileAt);
  const openFile = useAppStore((state) => state.openFile);
  const projects = useAppStore((state) => state.projects);
  const worlds = useAppStore((state) => state.worlds);
  const toast = useAppStore((state) => state.toast);

  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState("character");
  const [newName, setNewName] = useState("");
  const [container, setContainer] = useState("");

  const refresh = () => {
    void window.edenwright.query.entities().then(setEntities);
  };
  useEffect(refresh, [openFile?.path]);

  const containers = useMemo(
    () => [
      ...worlds.map((world) => ({
        id: `Worlds/${world.name}/codex`,
        label: `${world.name} (world)`,
      })),
      ...projects.map((project) => ({
        id: `Projects/${project.name}/codex`,
        label: project.name,
      })),
    ],
    [worlds, projects],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EntitySummary[]>();
    for (const entity of entities) {
      const type = entity.entityType ?? "character";
      const list = map.get(type) ?? [];
      list.push(entity);
      map.set(type, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entities]);

  const createEntity = async () => {
    const name = newName.trim();
    const dir = container || containers[0]?.id;
    if (!name || !dir) return;
    const typeDef =
      BUILTIN_ENTITY_TYPES.find((item) => item.type === newType) ??
      BUILTIN_ENTITY_TYPES[0];
    const fileName = `${dir}/${name}.md`;
    const id = `ent_${Math.random().toString(36).slice(2, 10)}`;
    const text = `---\nid: ${id}\ntype: ${typeDef.type}\nname: ${JSON.stringify(name)}\naliases: []\nfields: {}\n---\n\n`;
    try {
      await window.edenwright.files.write(fileName, text, null);
      setCreating(false);
      setNewName("");
      refresh();
      await openFileAt(fileName);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  return (
    <div className="codex-panel">
      <div className="codex-panel__header">
        <span className="codex-panel__label">Codex</span>
        <button
          type="button"
          className="codex-panel__new"
          title="New entity"
          onClick={() => setCreating((value) => !value)}
        >
          <Icon icon={Plus} size={15} />
        </button>
      </div>

      {creating ? (
        <div className="codex-panel__create">
          <select
            className="codex-panel__select"
            value={container || containers[0]?.id || ""}
            onChange={(event) => setContainer(event.target.value)}
          >
            {containers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="codex-panel__types">
            {BUILTIN_ENTITY_TYPES.map((typeDef) => (
              <button
                key={typeDef.type}
                type="button"
                className="codex-panel__type"
                data-active={newType === typeDef.type || undefined}
                onClick={() => setNewType(typeDef.type)}
              >
                {typeDef.label}
              </button>
            ))}
          </div>
          <input
            className="codex-panel__name"
            placeholder="Entity name…"
            value={newName}
            autoFocus
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createEntity();
              if (event.key === "Escape") setCreating(false);
            }}
          />
        </div>
      ) : null}

      <div className="codex-panel__list">
        {entities.length === 0 && !creating ? (
          <p className="codex-panel__empty">
            No entities yet — the codex is where your cast, places, and lore
            live. Make one with the + button.
          </p>
        ) : null}
        {grouped.map(([type, items]) => {
          const typeDef = BUILTIN_ENTITY_TYPES.find(
            (item) => item.type === type,
          );
          return (
            <section key={type} className="codex-panel__group">
              <h3 className="codex-panel__group-title">
                <Icon icon={lucideByName(typeDef?.icon)} size={13} />
                {typeDef?.label ?? type}
                <span className="codex-panel__count">{items.length}</span>
              </h3>
              {items.map((entity) => (
                <button
                  key={entity.path}
                  type="button"
                  className="codex-panel__entity"
                  data-active={openFile?.path === entity.path || undefined}
                  onClick={() => void openFileAt(entity.path)}
                >
                  <span className="codex-panel__entity-name">
                    {entity.name}
                  </span>
                  {entity.aliases.length > 0 ? (
                    <span className="codex-panel__entity-alias">
                      {entity.aliases[0]}
                    </span>
                  ) : null}
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
