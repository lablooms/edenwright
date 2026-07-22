import { useEffect, useMemo, useState } from "react";

import {
  BUILTIN_ENTITY_TYPES,
  mentionKeyForName,
  parseEntity,
  serializeEntity,
} from "@edenwright/core";
import { Code2, X } from "lucide-react";

import { Button, Icon } from "@edenwright/ui";

import type { AppearanceRow } from "../../../preload/api";
import { lucideByName } from "../lib/icons";
import { ipcErrorMessage, useAppStore } from "../store";
import "./codex-sheet.css";

/**
 * The designed entity sheet (§7.4): name, type, aliases, typed fields,
 * freeform notes, and appearances — never raw frontmatter. "Edit source"
 * drops to the raw markdown editor when wanted.
 */
export function CodexSheet() {
  const openFile = useAppStore((state) => state.openFile);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const setDraft = useAppStore((state) => state.setDraft);
  const saveFile = useAppStore((state) => state.saveFile);
  const setEditSource = useAppStore((state) => state.setEditSource);
  const worlds = useAppStore((state) => state.worlds);
  const toast = useAppStore((state) => state.toast);

  const parsed = useMemo(
    () => (openFile ? parseEntity(openFile.content) : null),
    [openFile],
  );

  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [appearances, setAppearances] = useState<AppearanceRow[]>([]);
  const [newAlias, setNewAlias] = useState("");

  useEffect(() => {
    if (parsed) {
      setName(parsed.name);
      setAliases(parsed.aliases);
      setFields(parsed.fields);
      setBody(parsed.body);
      setDirty(false);
      setNewAlias("");
    }
  }, [parsed]);

  useEffect(() => {
    if (!parsed) return;
    const key = mentionKeyForName(parsed.name);
    if (!key) return;
    void window.edenwright.query.appearances(key).then(setAppearances);
  }, [parsed, openFile?.mtimeMs]);

  if (!openFile || !parsed) return null;

  const typeDef = BUILTIN_ENTITY_TYPES.find(
    (item) => item.type === parsed.type,
  );

  const markDirty = () => setDirty(true);

  const save = () => {
    const text = serializeEntity({
      ...parsed,
      name: name.trim() || "Unnamed",
      aliases,
      fields,
      body,
    });
    setDraft(text);
    void saveFile();
    setDirty(false);
  };

  const setField = (key: string, value: unknown) => {
    setFields((current) => ({ ...current, [key]: value }));
    markDirty();
  };

  const removeAlias = (alias: string) => {
    setAliases((current) => current.filter((item) => item !== alias));
    markDirty();
  };

  const addAlias = () => {
    const trimmed = newAlias.trim();
    if (!trimmed || aliases.includes(trimmed)) return;
    setAliases((current) => [...current, trimmed]);
    setNewAlias("");
    markDirty();
  };

  return (
    <div className="codex-sheet">
      <header className="codex-sheet__header">
        <div className="codex-sheet__id">
          <span className="codex-sheet__type">
            <Icon icon={lucideByName(typeDef?.icon)} size={14} />
            {typeDef?.label ?? parsed.type}
          </span>
          <input
            className="codex-sheet__name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              markDirty();
            }}
          />
          <span className="codex-sheet__path">{openFile.path}</span>
        </div>
        <div className="codex-sheet__actions">
          {openFile.path.startsWith("Projects/") && worlds.length > 0 ? (
            <select
              className="codex-sheet__promote"
              value=""
              title="Move this entity into a world's shared codex (§7.5)"
              onChange={(event) => {
                const world = event.target.value;
                if (!world) return;
                void window.edenwright.entities
                  .promoteToWorld(openFile.path, world)
                  .then((target) => {
                    toast(`Promoted to ${world}'s codex.`);
                    return openFileAt(target);
                  })
                  .catch((error: unknown) =>
                    toast(ipcErrorMessage(error), "warn"),
                  );
              }}
            >
              <option value="">Promote to world…</option>
              {worlds.map((world) => (
                <option key={world.name} value={world.name}>
                  {world.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            variant="ghost"
            title="Edit the raw markdown source"
            onClick={() => setEditSource(true)}
          >
            <Icon icon={Code2} size={15} /> Source
          </Button>
          <Button
            variant={dirty ? "primary" : "ghost"}
            disabled={!dirty || openFile.saving}
            onClick={save}
          >
            {openFile.saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="codex-sheet__body">
        <section className="codex-sheet__section">
          <h3 className="codex-sheet__heading">Aliases</h3>
          <div className="codex-sheet__aliases">
            {aliases.map((alias) => (
              <span key={alias} className="codex-sheet__alias">
                {alias}
                <button
                  type="button"
                  className="codex-sheet__alias-remove"
                  title="Remove alias"
                  onClick={() => removeAlias(alias)}
                >
                  <Icon icon={X} size={11} />
                </button>
              </span>
            ))}
            <input
              className="codex-sheet__alias-input"
              placeholder="Add alias…"
              value={newAlias}
              onChange={(event) => setNewAlias(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addAlias();
              }}
              onBlur={addAlias}
            />
          </div>
        </section>

        {typeDef && typeDef.fields.length > 0 ? (
          <section className="codex-sheet__section">
            <h3 className="codex-sheet__heading">Details</h3>
            <div className="codex-sheet__fields">
              {typeDef.fields.map((fieldDef) => (
                <label key={fieldDef.key} className="codex-sheet__field">
                  <span className="codex-sheet__field-label">
                    {fieldDef.label}
                  </span>
                  <input
                    className="codex-sheet__field-input"
                    type={
                      fieldDef.kind === "number"
                        ? "number"
                        : fieldDef.kind === "date"
                          ? "date"
                          : "text"
                    }
                    value={String(fields[fieldDef.key] ?? "")}
                    onChange={(event) =>
                      setField(
                        fieldDef.key,
                        fieldDef.kind === "number"
                          ? Number(event.target.value) || ""
                          : event.target.value,
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className="codex-sheet__section codex-sheet__section--grow">
          <h3 className="codex-sheet__heading">Notes</h3>
          <textarea
            className="codex-sheet__notes"
            value={body}
            placeholder="Backstory, secrets, anything."
            spellCheck
            onChange={(event) => {
              setBody(event.target.value);
              markDirty();
            }}
          />
        </section>

        <section className="codex-sheet__section">
          <h3 className="codex-sheet__heading">
            Appearances
            <span className="codex-sheet__appearances-count">
              {appearances.length === 0
                ? "none yet"
                : `${appearances.length} ${appearances.length === 1 ? "file" : "files"}`}
            </span>
          </h3>
          {appearances.length === 0 ? (
            <p className="codex-sheet__appearances-empty">
              Mention @{mentionKeyForName(parsed.name)} in any scene and it
              shows up here, counted.
            </p>
          ) : (
            <ul className="codex-sheet__appearances">
              {appearances.map((row) => (
                <li key={row.path}>
                  <button
                    type="button"
                    className="codex-sheet__appearance"
                    onClick={() => void openFileAt(row.path)}
                  >
                    <span className="codex-sheet__appearance-path">
                      {row.path}
                    </span>
                    <span className="codex-sheet__appearance-count">
                      ×{row.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
