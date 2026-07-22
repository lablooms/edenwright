import { useEffect, useMemo, useState } from "react";
import { Globe, Plus } from "lucide-react";

import type { WorldInfo } from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";

import "./worlds-panel.css";

/**
 * Worlds panel (§7.5): every world in the eden, its entity count, and which
 * projects drink from it. Worlds are shared canon — this is their home.
 */
export function WorldsPanel() {
  const projects = useAppStore((state) => state.projects);
  const toast = useAppStore((state) => state.toast);
  const refreshTree = useAppStore((state) => state.refreshTree);

  const [worlds, setWorlds] = useState<WorldInfo[] | null>(null);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, entities] = await Promise.all([
        window.edenwright.worlds.list(),
        window.edenwright.query.entities(),
      ]);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const entity of entities) {
        if (entity.world) {
          counts[entity.world] = (counts[entity.world] ?? 0) + 1;
        }
      }
      setWorlds(list);
      setEntityCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkedBy = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const project of projects) {
      for (const world of project.linkedWorlds) {
        map[world] = [...(map[world] ?? []), project.name];
      }
    }
    return map;
  }, [projects]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await window.edenwright.worlds.create(trimmed);
      setName("");
      setCreating(false);
      setWorlds(await window.edenwright.worlds.list());
      await refreshTree();
      toast(`${trimmed} is born — a whole world.`);
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  return (
    <div className="ew-worlds">
      <div className="ew-worlds__header">
        <Globe size={16} aria-hidden />
        <h2>Worlds</h2>
      </div>
      <p className="ew-worlds__blurb">
        Shared canon for every project in this eden — entities, wiki pages,
        maps.
      </p>

      {worlds === null ? (
        <p className="ew-worlds__loading">Surveying the maps…</p>
      ) : worlds.length === 0 ? (
        <div className="ew-worlds__empty">
          <Globe size={28} aria-hidden />
          <p>No worlds yet. Every universe starts with one brave decision.</p>
        </div>
      ) : (
        <ul className="ew-worlds__list">
          {worlds.map((world) => (
            <li key={world.id} className="ew-worlds__card">
              <div className="ew-worlds__card-top">
                <span className="ew-worlds__name">{world.name}</span>
                <span className="ew-worlds__count">
                  {entityCounts[world.name] ?? 0}{" "}
                  {(entityCounts[world.name] ?? 0) === 1
                    ? "entity"
                    : "entities"}
                </span>
              </div>
              {world.description ? (
                <p className="ew-worlds__description">{world.description}</p>
              ) : null}
              <p className="ew-worlds__linked">
                {linkedBy[world.name]?.length
                  ? `Linked by ${linkedBy[world.name].join(", ")}`
                  : "Not linked by any project yet"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <form
          className="ew-worlds__create"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <input
            className="ew-worlds__input"
            placeholder="Name the world…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <button type="submit" className="ew-worlds__submit">
            Create
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="ew-worlds__new"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} aria-hidden /> New world
        </button>
      )}
    </div>
  );
}
