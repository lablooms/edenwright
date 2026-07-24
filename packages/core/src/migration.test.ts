import { describe, expect, it } from "vitest";

import { loadEdenManifest, needsMigration } from "./eden-structure.js";
import { migrateLegacyEden } from "./migration.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

function legacyProjectJson(
  id: string,
  name: string,
  linkedWorlds: string[] = [],
): string {
  return `${JSON.stringify(
    {
      id,
      name,
      preset: "novel",
      medium: "prose",
      createdAt: "2026-01-01T00:00:00.000Z",
      linkedWorlds,
      goals: { targetWords: 50000 },
      order: ["part_1"],
    },
    null,
    2,
  )}\n`;
}

function legacyWorldJson(id: string, name: string, description = ""): string {
  return `${JSON.stringify(
    { id, name, description, createdAt: "2026-01-01T00:00:00.000Z" },
    null,
    2,
  )}\n`;
}

/** A single-project legacy eden with one linked world. */
async function fixtureSingleProjectEden(
  fs: InMemoryFileSystemAdapter,
  root: string,
): Promise<void> {
  await fs.writeFile(`${root}/.eden/settings.json`, '{"theme":{"id":"x"}}');
  await fs.writeFile(
    `${root}/Projects/Hollow Crown/project.json`,
    legacyProjectJson("prj_hollow", "Hollow Crown", ["wld_aster"]),
  );
  await fs.writeFile(
    `${root}/Projects/Hollow Crown/manuscript/chapter one.md`,
    "# Chapter One\n\nYuki ran.",
  );
  await fs.writeFile(
    `${root}/Projects/Hollow Crown/exports/.gitignore`,
    "*\n!.gitignore\n",
  );
  await fs.writeFile(
    `${root}/Worlds/Aster Reach/world.json`,
    legacyWorldJson("wld_aster", "Aster Reach", "The city above the fog."),
  );
  await fs.writeFile(
    `${root}/Worlds/Aster Reach/codex/yuki.md`,
    "---\nname: Yuki\n---\n",
  );
  await fs.writeFile(
    `${root}/Worlds/Aster Reach/notes/history.md`,
    "# History",
  );
}

describe("migrateLegacyEden — single project", () => {
  it("collapses in place: manifest, scaffold at root, world merged, backup kept", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const root = "/edens/My Story";
    await fixtureSingleProjectEden(fs, root);

    const report = await migrateLegacyEden(fs, root);

    expect(report.converted).toEqual([{ name: "My Story", path: root }]);
    expect(report.legacyBackupPath).toBe(`${root}/.eden/migration-backup`);
    expect(await needsMigration(fs, root)).toBe(false);

    // eden.json: the project's fields, minus linkedWorlds, plus the
    // linked world's description.
    const manifest = await loadEdenManifest(fs, root);
    expect(manifest).toEqual({
      id: "prj_hollow",
      name: "Hollow Crown",
      preset: "novel",
      medium: "prose",
      createdAt: "2026-01-01T00:00:00.000Z",
      description: "The city above the fog.",
      goals: { targetWords: 50000 },
      order: ["part_1"],
    });
    const rawManifest = JSON.parse(await fs.readFile(`${root}/eden.json`));
    expect("linkedWorlds" in rawManifest).toBe(false);

    // Project contents moved up to the root, byte-identical.
    expect(await fs.readFile(`${root}/manuscript/chapter one.md`)).toBe(
      "# Chapter One\n\nYuki ran.",
    );
    expect(await fs.readFile(`${root}/exports/.gitignore`)).toBe(
      "*\n!.gitignore\n",
    );

    // Linked world merged into the fixed world/ subdirs.
    expect(await fs.readFile(`${root}/world/codex/yuki.md`)).toBe(
      "---\nname: Yuki\n---\n",
    );
    expect(await fs.readFile(`${root}/world/notes/history.md`)).toBe(
      "# History",
    );

    // Legacy top-level dirs are gone.
    expect(await fs.exists(`${root}/Projects`)).toBe(false);
    expect(await fs.exists(`${root}/Worlds`)).toBe(false);

    // Backup holds every legacy manifest, byte-identical.
    expect(
      await fs.readFile(
        `${root}/.eden/migration-backup/Projects/Hollow Crown/project.json`,
      ),
    ).toBe(legacyProjectJson("prj_hollow", "Hollow Crown", ["wld_aster"]));
    expect(
      await fs.readFile(
        `${root}/.eden/migration-backup/Worlds/Aster Reach/world.json`,
      ),
    ).toBe(
      legacyWorldJson("wld_aster", "Aster Reach", "The city above the fog."),
    );

    // Untouched: settings stay where they were.
    expect(await fs.readFile(`${root}/.eden/settings.json`)).toBe(
      '{"theme":{"id":"x"}}',
    );
  });

  it("renames colliding world files instead of overwriting", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const root = "/edens/Collide";
    await fs.mkdir(`${root}/.eden`);
    await fs.writeFile(
      `${root}/Projects/P/project.json`,
      legacyProjectJson("prj_p", "P", ["wld_a", "wld_b"]),
    );
    await fs.writeFile(
      `${root}/Worlds/A/world.json`,
      legacyWorldJson("wld_a", "A"),
    );
    await fs.writeFile(`${root}/Worlds/A/codex/yuki.md`, "from A");
    await fs.writeFile(
      `${root}/Worlds/B/world.json`,
      legacyWorldJson("wld_b", "B"),
    );
    await fs.writeFile(`${root}/Worlds/B/codex/yuki.md`, "from B");

    await migrateLegacyEden(fs, root);

    // Worlds merge in sorted order — first keeps the name, later is renamed.
    expect(await fs.readFile(`${root}/world/codex/yuki.md`)).toBe("from A");
    expect(await fs.readFile(`${root}/world/codex/yuki-2.md`)).toBe("from B");
  });

  it("adopts a lone unlinked world and archives extras whole", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const root = "/edens/Adopt";
    await fs.mkdir(`${root}/.eden`);
    await fs.writeFile(
      `${root}/Projects/P/project.json`,
      legacyProjectJson("prj_p", "P"),
    );
    await fs.writeFile(
      `${root}/Worlds/Only/world.json`,
      legacyWorldJson("wld_only", "Only", "Solo."),
    );
    await fs.writeFile(`${root}/Worlds/Only/codex/mira.md`, "Mira");

    const report = await migrateLegacyEden(fs, root);
    const manifest = await loadEdenManifest(fs, root);
    expect(manifest.description).toBe("Solo.");
    expect(await fs.readFile(`${root}/world/codex/mira.md`)).toBe("Mira");
    expect(report.converted[0].path).toBe(root);
  });

  it("archives worlds the project does not link, losing nothing", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const root = "/edens/Archive";
    await fs.mkdir(`${root}/.eden`);
    await fs.writeFile(
      `${root}/Projects/P/project.json`,
      legacyProjectJson("prj_p", "P", ["wld_keep"]),
    );
    await fs.writeFile(
      `${root}/Worlds/Keep/world.json`,
      legacyWorldJson("wld_keep", "Keep"),
    );
    await fs.writeFile(`${root}/Worlds/Keep/codex/a.md`, "A");
    await fs.writeFile(
      `${root}/Worlds/Side/world.json`,
      legacyWorldJson("wld_side", "Side", "Not linked."),
    );
    await fs.writeFile(`${root}/Worlds/Side/notes/side.md`, "side notes");

    await migrateLegacyEden(fs, root);

    expect(await fs.readFile(`${root}/world/codex/a.md`)).toBe("A");
    expect(
      await fs.readFile(`${root}/world/archived-worlds/Side/world.json`),
    ).toBe(legacyWorldJson("wld_side", "Side", "Not linked."));
    expect(
      await fs.readFile(`${root}/world/archived-worlds/Side/notes/side.md`),
    ).toBe("side notes");
  });
});

describe("migrateLegacyEden — multi project", () => {
  it("splits into sibling edens and renames the untouched original", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const root = "/edens/Saga";
    await fs.writeFile(`${root}/.eden/settings.json`, '{"theme":{"id":"x"}}');
    await fs.writeFile(
      `${root}/Projects/Ashes/project.json`,
      legacyProjectJson("prj_ashes", "Ashes", ["wld_ember"]),
    );
    await fs.writeFile(`${root}/Projects/Ashes/manuscript/a.md`, "ashes draft");
    await fs.writeFile(
      `${root}/Projects/Bloom/project.json`,
      legacyProjectJson("prj_bloom", "Bloom"),
    );
    await fs.writeFile(`${root}/Projects/Bloom/manuscript/b.md`, "bloom draft");
    await fs.writeFile(
      `${root}/Worlds/Ember/world.json`,
      legacyWorldJson("wld_ember", "Ember", "Cinders."),
    );
    await fs.writeFile(`${root}/Worlds/Ember/codex/ash.md`, "Ash");
    // Unlinked by any project: survives only in the -legacy copy.
    await fs.writeFile(
      `${root}/Worlds/Drift/world.json`,
      legacyWorldJson("wld_drift", "Drift"),
    );

    const report = await migrateLegacyEden(fs, root);

    expect(report.converted).toEqual([
      { name: "Saga — Ashes", path: "/edens/Saga — Ashes" },
      { name: "Saga — Bloom", path: "/edens/Saga — Bloom" },
    ]);
    expect(report.legacyBackupPath).toBe("/edens/Saga-legacy");

    // Each sibling is a full eden: manifest, contents at root, meta copied.
    const ashes = await loadEdenManifest(fs, "/edens/Saga — Ashes");
    expect(ashes).toMatchObject({
      id: "prj_ashes",
      name: "Ashes",
      description: "Cinders.",
    });
    expect(
      "linkedWorlds" in
        JSON.parse(await fs.readFile("/edens/Saga — Ashes/eden.json")),
    ).toBe(false);
    expect(await fs.readFile("/edens/Saga — Ashes/manuscript/a.md")).toBe(
      "ashes draft",
    );
    expect(await fs.readFile("/edens/Saga — Ashes/world/codex/ash.md")).toBe(
      "Ash",
    );
    for (const dir of [".eden/snapshots", ".eden/plugins", ".eden/themes"]) {
      expect(await fs.exists(`/edens/Saga — Ashes/${dir}`)).toBe(true);
    }
    expect(await fs.readFile("/edens/Saga — Ashes/.eden/settings.json")).toBe(
      '{"theme":{"id":"x"}}',
    );

    const bloom = await loadEdenManifest(fs, "/edens/Saga — Bloom");
    expect(bloom).toMatchObject({ id: "prj_bloom", name: "Bloom" });
    expect(await fs.readFile("/edens/Saga — Bloom/manuscript/b.md")).toBe(
      "bloom draft",
    );

    // The original is renamed, fully intact — every byte still there.
    expect(await fs.exists(root)).toBe(false);
    expect(
      await fs.readFile("/edens/Saga-legacy/Projects/Ashes/project.json"),
    ).toBe(legacyProjectJson("prj_ashes", "Ashes", ["wld_ember"]));
    expect(
      await fs.readFile("/edens/Saga-legacy/Projects/Ashes/manuscript/a.md"),
    ).toBe("ashes draft");
    expect(
      await fs.readFile("/edens/Saga-legacy/Worlds/Ember/codex/ash.md"),
    ).toBe("Ash");
    expect(
      await fs.readFile("/edens/Saga-legacy/Worlds/Drift/world.json"),
    ).toBe(legacyWorldJson("wld_drift", "Drift"));
    expect(await fs.readFile("/edens/Saga-legacy/.eden/settings.json")).toBe(
      '{"theme":{"id":"x"}}',
    );
  });
});
