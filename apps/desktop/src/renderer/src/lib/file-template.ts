import { newId, serializeMarkdown } from "@edenwright/core";

import type { PresetDefinition } from "@edenwright/plugin-api";

/**
 * Frontmatter stamped on files created through the UI (SPEC §6.1, §6.2):
 * stable IDs, preset default fields for manuscript nodes, typed fields for
 * codex entities. Users can edit everything — it's their frontmatter.
 */
export function newFileTemplate(options: {
  kind: "manuscript" | "codex" | "note";
  name: string;
  preset?: PresetDefinition | null;
}): string {
  if (options.kind === "codex") {
    return serializeMarkdown(
      {
        id: newId("ent"),
        type: "character",
        name: options.name,
        aliases: [],
      },
      "\n",
    );
  }
  const data: Record<string, unknown> = {
    id: newId("scn"),
    ...(options.preset?.defaultFields ?? {}),
  };
  return serializeMarkdown(data, "\n");
}
