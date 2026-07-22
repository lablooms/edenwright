import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

import type { EntitySummary, FileSummary } from "../../../preload/api";

/**
 * `[[` completes files, `@` completes codex entities (SPEC §7.3, §7.4).
 * Both read the index through the query bridge — never a stale hand-list.
 */

export function wikiLinkCompletion(
  getFiles: () => Promise<FileSummary[]>,
): (context: CompletionContext) => Promise<CompletionResult | null> {
  return async (context) => {
    const match = context.matchBefore(/\[\[([^\][]*)$/);
    if (!match) return null;
    const files = await getFiles();
    return {
      from: match.from + 2,
      options: files.map((file) => ({
        label: file.title,
        detail: file.path,
        type: "text",
      })),
      validFor: /^[^\][]*$/,
    };
  };
}

export function mentionCompletion(
  getEntities: () => Promise<EntitySummary[]>,
): (context: CompletionContext) => Promise<CompletionResult | null> {
  return async (context) => {
    const match = context.matchBefore(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u);
    if (!match) return null;
    const entities = await getEntities();
    return {
      from: match.from + match.text.indexOf("@") + 1,
      options: entities.map((entity) => {
        const key = entity.name.split(/\s+/)[0].toLowerCase();
        // Linked worlds' entities are badged with their world (§7.5).
        const badge = entity.world ? `${entity.world} · ` : "";
        const kind = entity.entityType ?? "";
        return {
          label: `@${key}`,
          detail: `${entity.name}${kind || badge ? ` · ${badge}${kind}` : ""}`,
          type: "constant",
          apply: key,
        };
      }),
      validFor: /^[\p{L}\p{N}_-]*$/u,
    };
  };
}
