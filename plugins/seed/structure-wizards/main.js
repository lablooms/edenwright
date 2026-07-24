/**
 * Structure Wizards (SPEC §9.6.1): guided outline generators that scaffold
 * the eden's tree. Everything happens through the public plugin API — files
 * are created with ctx.eden.fs, existing files are never overwritten.
 */

const { definePlugin } = require("@edenwright/plugin-api");

const WIZARDS = [
  {
    id: "snowflake",
    name: "Snowflake Method",
    steps: [
      [
        "01 - One-sentence summary",
        "One sentence. The whole novel, honestly compressed.",
      ],
      [
        "02 - One-paragraph summary",
        "Expand to five sentences: setup, three disasters, ending.",
      ],
      [
        "03 - Character summaries",
        "A page each: name, motivation, goal, conflict, epiphany.",
      ],
      [
        "04 - Expand each sentence",
        "Each sentence of step 2 becomes a paragraph.",
      ],
      [
        "05 - Character synopses",
        "The story from each major character's point of view.",
      ],
      [
        "06 - Expand each paragraph",
        "Each paragraph of step 4 becomes a page.",
      ],
      ["07 - Character charts", "Full charts: backstory, quirks, voice, arc."],
      ["08 - Scene list", "Every scene, one line each, in order."],
      [
        "09 - Scene descriptions",
        "A paragraph per scene — conflict, setback, turn.",
      ],
      ["10 - First draft", "You know this story now. Write it."],
    ],
  },
  {
    id: "save-the-cat",
    name: "Save the Cat",
    steps: [
      [
        "01 - Opening image",
        "The before snapshot — tone, mood, the hero's stasis.",
      ],
      [
        "02 - Theme stated",
        "Someone says the theme out loud. The hero isn't listening yet.",
      ],
      ["03 - Setup", "The world as it is, and everything the hero lacks."],
      ["04 - Catalyst", "The thing that happens that can't be undone."],
      ["05 - Debate", "Should I? The last chance to stay home."],
      ["06 - Break into two", "The hero chooses. The old world ends here."],
      [
        "07 - B story",
        "The love story, or the friendship that carries the theme.",
      ],
      ["08 - Fun and games", "The promise of the premise. The trailer scenes."],
      ["09 - Midpoint", "Stakes rise, false victory or false defeat."],
      ["10 - Bad guys close in", "External pressure, internal rot."],
      ["11 - All is lost", "The whiff of death. Nothing left."],
      [
        "12 - Dark night of the soul",
        "The hero, beaten, finally hears the theme.",
      ],
      ["13 - Break into three", "A and B stories meet. The answer."],
      ["14 - Finale", "The new world, built from the lesson."],
      ["15 - Final image", "The after snapshot — proof of change."],
    ],
  },
  {
    id: "heros-journey",
    name: "Hero's Journey",
    steps: [
      ["01 - Ordinary world", "The hero at home, in the known."],
      ["02 - Call to adventure", "The problem or challenge appears."],
      ["03 - Refusal of the call", "Fear. The cost of saying yes."],
      ["04 - Meeting the mentor", "Guidance, a gift, a push."],
      ["05 - Crossing the threshold", "Into the special world."],
      [
        "06 - Tests, allies, enemies",
        "The rules of the new world, learned the hard way.",
      ],
      ["07 - Approach to the inmost cave", "Preparation for the ordeal."],
      ["08 - Ordeal", "The central crisis — death faced, in some form."],
      ["09 - Reward", "Seizing the sword: the prize, the knowledge."],
      ["10 - The road back", "The chase home. The stakes re-lit."],
      ["11 - Resurrection", "The final test — the hero transformed."],
      ["12 - Return with the elixir", "Home, carrying the thing that heals."],
    ],
  },
];

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    for (const wizard of WIZARDS) {
      ctx.commands.register({
        id: `structure-wizards:${wizard.id}`,
        name: `Scaffold outline: ${wizard.name}`,
        callback: async () => {
          // One eden = one story: outlines grow at the eden root.
          const base = `outline/${wizard.name}`;
          await ctx.eden.fs.mkdir(base);
          let created = 0;
          let skipped = 0;
          for (const [fileName, prompt] of wizard.steps) {
            const path = `${base}/${fileName}.md`;
            // Data safety above convenience: never overwrite an existing file.
            if (await ctx.eden.fs.exists(path)) {
              skipped += 1;
              continue;
            }
            await ctx.eden.fs.writeFile(
              path,
              `---\ntitle: ${fileName.replace(/^\d+ - /, "")}\nstatus: planned\nwizard: ${wizard.id}\n---\n\n${prompt}\n`,
            );
            created += 1;
          }
          ctx.notices.show(
            skipped > 0
              ? `${wizard.name}: ${created} files planted, ${skipped} kept (already existed).`
              : `${wizard.name}: ${created} outline files planted in outline/.`,
          );
        },
      });
    }
  },
});
