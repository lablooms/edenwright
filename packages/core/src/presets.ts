/**
 * The built-in preset library (SPEC v2 §6): every medium a project can be,
 * as pure data. There are no engines — these describe the one story
 * skeleton in each medium's own terms. Community presets join through the
 * plugin API with exactly this shape.
 */

export interface BuiltinPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  medium: "prose" | "screenplay" | "comic" | "interactive" | "world";
  terminology: { document: string; documents: string };
  structure: { id: string; label: string; required?: boolean }[];
  defaultFields: Record<string, unknown>;
  scaffold: { path: string; contents?: string }[];
  exportDefaults?: string[];
  suggestedPlugins?: string[];
}

const PROSE_SCAFFOLD = [
  { path: "manuscript" },
  { path: "codex" },
  { path: "notes" },
];
const PROSE_FIELDS = { status: "draft", synopsis: "", pov: "" };
const SCENE = { document: "Scene", documents: "Scenes" } as const;

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  // — Prose —
  {
    id: "novel",
    name: "Novel",
    description: "Long-form fiction — scenes, chapters, parts.",
    icon: "BookOpen",
    medium: "prose",
    terminology: SCENE,
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: PROSE_FIELDS,
    scaffold: PROSE_SCAFFOLD,
    exportDefaults: ["docx", "epub", "pdf", "markdown"],
  },
  {
    id: "novella",
    name: "Novella / Short story",
    description: "Shorter fiction, one arc.",
    icon: "BookOpen",
    medium: "prose",
    terminology: SCENE,
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: PROSE_FIELDS,
    scaffold: PROSE_SCAFFOLD,
    exportDefaults: ["docx", "epub", "pdf", "markdown"],
  },
  {
    id: "collection",
    name: "Collection",
    description: "Short stories or essays under one cover.",
    icon: "Library",
    medium: "prose",
    terminology: { document: "Story", documents: "Stories" },
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: PROSE_FIELDS,
    scaffold: PROSE_SCAFFOLD,
    exportDefaults: ["docx", "epub", "pdf", "markdown"],
  },
  {
    id: "serial",
    name: "Serial / Web novel",
    description: "Episodes published on a schedule.",
    icon: "Rss",
    medium: "prose",
    terminology: { document: "Episode", documents: "Episodes" },
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: { ...PROSE_FIELDS, published: "" },
    scaffold: PROSE_SCAFFOLD,
    exportDefaults: ["markdown", "html", "epub"],
  },
  {
    id: "light-novel",
    name: "Light novel",
    description: "Fast prose with illustrations — scene-first.",
    icon: "Sparkles",
    medium: "prose",
    terminology: SCENE,
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: PROSE_FIELDS,
    scaffold: [...PROSE_SCAFFOLD, { path: "illustrations" }],
    exportDefaults: ["docx", "epub", "pdf", "markdown"],
  },
  {
    id: "memoir",
    name: "Memoir / Nonfiction",
    description: "True stories, told like stories.",
    icon: "Feather",
    medium: "prose",
    terminology: { document: "Chapter", documents: "Chapters" },
    structure: [{ id: "manuscript", label: "Manuscript", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: PROSE_SCAFFOLD,
    exportDefaults: ["docx", "epub", "pdf", "markdown"],
  },

  // — Screenplay —
  {
    id: "feature-film",
    name: "Feature film",
    description: "90–120 pages, industry format.",
    icon: "Clapperboard",
    medium: "screenplay",
    terminology: SCENE,
    structure: [{ id: "screenplay", label: "Screenplay", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "fountain", "fdx", "text"],
    suggestedPlugins: ["lablooms.screenplay-mode"],
  },
  {
    id: "tv-series",
    name: "TV series",
    description: "Episodes in seasons; act structure welcome.",
    icon: "Tv",
    medium: "screenplay",
    terminology: { document: "Episode", documents: "Episodes" },
    structure: [{ id: "screenplay", label: "Screenplay", required: true }],
    defaultFields: { status: "draft", synopsis: "", season: "", episode: "" },
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "fountain", "fdx", "text"],
    suggestedPlugins: ["lablooms.screenplay-mode"],
  },
  {
    id: "stage-play",
    name: "Stage play / Musical",
    description: "Scenes and songs for the stage.",
    icon: "Theater",
    medium: "screenplay",
    terminology: SCENE,
    structure: [{ id: "screenplay", label: "Script", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "fountain", "text"],
    suggestedPlugins: ["lablooms.screenplay-mode"],
  },
  {
    id: "animation",
    name: "Animation",
    description: "Scripted for boards and voice booths.",
    icon: "Film",
    medium: "screenplay",
    terminology: SCENE,
    structure: [{ id: "screenplay", label: "Screenplay", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "fountain", "fdx", "text"],
    suggestedPlugins: ["lablooms.screenplay-mode"],
  },
  {
    id: "audio-drama",
    name: "Audio drama / Podcast",
    description: "Written for the ear — SFX and music cues first-class.",
    icon: "AudioLines",
    medium: "screenplay",
    terminology: SCENE,
    structure: [{ id: "screenplay", label: "Script", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "fountain", "text"],
    suggestedPlugins: ["lablooms.screenplay-mode"],
  },

  // — Comic —
  {
    id: "manga",
    name: "Manga",
    description: "Right-to-left pages, panel rhythm.",
    icon: "BookImage",
    medium: "comic",
    terminology: { document: "Page", documents: "Pages" },
    structure: [{ id: "pages", label: "Pages", required: true }],
    defaultFields: { status: "draft", synopsis: "", direction: "rtl" },
    scaffold: [{ path: "pages" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "docx", "text"],
    suggestedPlugins: ["lablooms.comic-rail"],
  },
  {
    id: "western-comic",
    name: "Western comic / Graphic novel",
    description: "Issues and volumes, left to right.",
    icon: "BookImage",
    medium: "comic",
    terminology: { document: "Page", documents: "Pages" },
    structure: [{ id: "pages", label: "Pages", required: true }],
    defaultFields: { status: "draft", synopsis: "", direction: "ltr" },
    scaffold: [{ path: "pages" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "docx", "text"],
    suggestedPlugins: ["lablooms.comic-rail"],
  },
  {
    id: "webtoon",
    name: "Webtoon",
    description: "Vertical scroll, episode drops.",
    icon: "Smartphone",
    medium: "comic",
    terminology: { document: "Episode", documents: "Episodes" },
    structure: [{ id: "pages", label: "Episodes", required: true }],
    defaultFields: { status: "draft", synopsis: "", published: "" },
    scaffold: [{ path: "pages" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "text"],
    suggestedPlugins: ["lablooms.comic-rail"],
  },
  {
    id: "picture-book",
    name: "Picture book",
    description: "Words and pictures in lockstep, 32 pages at a time.",
    icon: "Image",
    medium: "comic",
    terminology: { document: "Spread", documents: "Spreads" },
    structure: [{ id: "pages", label: "Spreads", required: true }],
    defaultFields: { status: "draft", synopsis: "" },
    scaffold: [{ path: "pages" }, { path: "codex" }, { path: "notes" }],
    exportDefaults: ["pdf", "text"],
    suggestedPlugins: ["lablooms.comic-rail"],
  },

  // — Interactive —
  {
    id: "visual-novel",
    name: "Visual novel",
    description: "Routes, choices, flag conditions.",
    icon: "Waypoints",
    medium: "interactive",
    terminology: { document: "Node", documents: "Nodes" },
    structure: [{ id: "nodes", label: "Nodes", required: true }],
    defaultFields: { status: "draft" },
    scaffold: [
      { path: "nodes" },
      { path: "codex" },
      { path: "notes" },
      {
        path: "graph.json",
        contents: '{\n  "nodes": [],\n  "edges": [],\n  "flags": []\n}\n',
      },
    ],
    exportDefaults: ["rpy", "tw", "pdf", "json"],
    suggestedPlugins: ["lablooms.story-canvas"],
  },
  {
    id: "game-narrative",
    name: "Game narrative",
    description: "Quests, cutscenes, barks — heavy codex linkage.",
    icon: "Gamepad2",
    medium: "interactive",
    terminology: { document: "Node", documents: "Nodes" },
    structure: [{ id: "nodes", label: "Nodes", required: true }],
    defaultFields: { status: "draft" },
    scaffold: [
      { path: "nodes" },
      { path: "codex" },
      { path: "notes" },
      {
        path: "graph.json",
        contents: '{\n  "nodes": [],\n  "edges": [],\n  "flags": []\n}\n',
      },
    ],
    exportDefaults: ["json", "pdf"],
    suggestedPlugins: ["lablooms.story-canvas"],
  },
  {
    id: "interactive-fiction",
    name: "Interactive fiction / Gamebook",
    description: "Passage-style nodes; Twee/Twine export.",
    icon: "GitBranch",
    medium: "interactive",
    terminology: { document: "Passage", documents: "Passages" },
    structure: [{ id: "nodes", label: "Passages", required: true }],
    defaultFields: { status: "draft" },
    scaffold: [
      { path: "nodes" },
      { path: "codex" },
      { path: "notes" },
      {
        path: "graph.json",
        contents: '{\n  "nodes": [],\n  "edges": [],\n  "flags": []\n}\n',
      },
    ],
    exportDefaults: ["tw", "pdf", "json"],
    suggestedPlugins: ["lablooms.story-canvas"],
  },
  {
    id: "ttrpg-campaign",
    name: "TTRPG campaign",
    description: "Sessions as nodes; GM/player visibility honored by exports.",
    icon: "Dices",
    medium: "interactive",
    terminology: { document: "Session", documents: "Sessions" },
    structure: [{ id: "nodes", label: "Sessions", required: true }],
    defaultFields: { status: "draft", visibility: "gm" },
    scaffold: [
      { path: "nodes" },
      { path: "codex" },
      { path: "notes" },
      {
        path: "graph.json",
        contents: '{\n  "nodes": [],\n  "edges": [],\n  "flags": []\n}\n',
      },
    ],
    exportDefaults: ["pdf", "json"],
    suggestedPlugins: ["lablooms.story-canvas"],
  },

  // — World —
  {
    id: "worldbuilding",
    name: "Worldbuilding / Series bible",
    description: "Entity tree, freeform wiki pages, maps with pins.",
    icon: "Globe",
    medium: "world",
    terminology: { document: "Entity", documents: "Entities" },
    structure: [{ id: "codex", label: "Codex", required: true }],
    defaultFields: {},
    scaffold: [],
    exportDefaults: ["pdf", "docx"],
  },
];

/** Look up a built-in preset by id. */
export function findBuiltinPreset(id: string): BuiltinPreset | undefined {
  return BUILTIN_PRESETS.find((preset) => preset.id === id);
}
