import { describe, expect, it } from "vitest";

import {
  BUILTIN_ENTITY_TYPES,
  mentionKeyForName,
  parseEntity,
  serializeEntity,
} from "./codex.js";

const sample = `---
id: ent_yuki
type: character
name: Yuki Harrow
aliases:
  - The Gray Fox
fields:
  age: 27
  pronouns: she/her
storyDate: 1042-03-17
---
Free-form notes, backstory, anything.
`;

describe("parseEntity / serializeEntity", () => {
  it("parses a full entity file", () => {
    const entity = parseEntity(sample);
    expect(entity.stableId).toBe("ent_yuki");
    expect(entity.type).toBe("character");
    expect(entity.name).toBe("Yuki Harrow");
    expect(entity.aliases).toEqual(["The Gray Fox"]);
    expect(entity.fields).toEqual({ age: 27, pronouns: "she/her" });
    expect(entity.body).toBe("Free-form notes, backstory, anything.\n");
  });

  it("round-trips, preserving unrelated frontmatter keys", () => {
    const entity = parseEntity(sample);
    entity.fields = { ...entity.fields, age: 28 };
    const out = serializeEntity(entity);
    const again = parseEntity(out);
    expect(again.fields.age).toBe(28);
    expect(again.frontmatter.storyDate).toBe("1042-03-17");
    expect(again.body).toBe(entity.body);
  });

  it("tolerates a bare notes file", () => {
    const entity = parseEntity("Just notes.\n");
    expect(entity.stableId).toBeNull();
    expect(entity.type).toBe("character");
    expect(entity.aliases).toEqual([]);
  });
});

describe("mentionKeyForName", () => {
  it("takes the lowercase first word", () => {
    expect(mentionKeyForName("Yuki Harrow")).toBe("yuki");
    expect(mentionKeyForName("The Gray Fox")).toBe("the");
  });
});

describe("BUILTIN_ENTITY_TYPES", () => {
  it("covers the SPEC §6.2 five", () => {
    expect(BUILTIN_ENTITY_TYPES.map((t) => t.type)).toEqual([
      "character",
      "place",
      "item",
      "faction",
      "lore",
    ]);
  });
});
