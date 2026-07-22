/**
 * Medium Exporters (SPEC v2 §5): the medium export formats that were v1
 * engine serializers, ported onto the public plugin API as one seed
 * plugin — screenplay (industry PDF, Fountain, FDX, plain text), comic
 * (script PDF, canonical text), and interactive (Ren'Py, Twee, outline
 * PDF, graph JSON dump).
 *
 * The medium editor modes and views live in sibling seed plugins
 * (screenplay-mode, comic-rail, story-canvas); this one only exports.
 * Community plugins may only import the plugin API, so every parser and
 * serializer is inlined here (the same constraint the extra-exporters
 * seed documents). The logic matches the v1 engines; what changed is
 * the plumbing, not the behavior.
 */

const { definePlugin } = require("@edenwright/plugin-api");

/* --------------------------------------------------------------------
 * Shared helpers — inlined because no app package reaches a plugin.
 * -------------------------------------------------------------------- */

const escapeXml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const FRONTMATTER_RE =
  /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Minimal frontmatter reader: enough to strip the block and to read flat
 * `key: value` scalars (the TTRPG preset's `visibility: gm` among them).
 */
function parseFrontmatter(text) {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!entry) continue;
    data[entry[1]] = entry[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, body: text.slice(match[0].length) };
}

const stripFrontmatter = (text) => parseFrontmatter(text).body;

const inline = (text) =>
  escapeXml(text)
    .replace(/\[\[([^\]|]*)\|([^\]|]*)\]\]/g, "$2")
    .replace(/\[\[([^\]|]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>")
    .replace(/(\*|_)(.*?)\1/g, "<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

/** Tiny markdown→HTML: headings, emphasis, links, paragraphs. No deps. */
const markdownToHtml = (markdown) =>
  markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(block);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      if (block.startsWith("> ")) {
        return `<blockquote>${inline(block.replace(/^>\s?/gm, ""))}</blockquote>`;
      }
      return `<p>${inline(block.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");

const walkMarkdown = async (fs, dir, out = []) => {
  let entries = [];
  try {
    entries = await fs.list(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.kind === "directory") {
      // Old exports are not source material.
      if (entry.name !== "exports") await walkMarkdown(fs, path, out);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
};

const sanitize = (name) =>
  name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");

async function collectSections(fs, projectPath) {
  const files = (await walkMarkdown(fs, projectPath)).sort();
  const sections = [];
  for (const path of files) {
    const body = stripFrontmatter(await fs.readFile(path));
    const heading = /^#{1,6}\s+(.+?)\s*$/m.exec(body);
    const fileName = path
      .slice(path.lastIndexOf("/") + 1)
      .replace(/\.md$/i, "");
    sections.push({ path, title: heading?.[1] ?? fileName, body });
  }
  return sections;
}

const projectNameOf = (projectPath) =>
  projectPath.split("/").filter(Boolean).pop() ?? "project";

/* --------------------------------------------------------------------
 * Screenplay element inference (SPEC §8.3, ported from v1
 * engines/script). The exports classify with the editor's own model —
 * one inference, four serializers. Elements: Scene Heading → Action →
 * Character → Dialogue → Parenthetical → Transition, plus SONG and
 * SOUND cues for musical/audio presets.
 * -------------------------------------------------------------------- */

const SCENE_HEADING_RE = /^(INT|EXT|EST|I\/E)[\s./]/i;
const TRANSITION_RE = /TO:\s*$/;
const SONG_RE = /^SONG:/i;
const SOUND_RE = /^SOUND:/i;

function isAllCaps(text) {
  if (!/[\p{L}]/u.test(text)) return false;
  return text === text.toUpperCase();
}

/** Classify one line given its text and the tracked context. */
function inferElement(text, context) {
  const trimmed = text.trim();

  if (SCENE_HEADING_RE.test(trimmed)) return "scene-heading";
  if (SONG_RE.test(trimmed)) return "song";
  if (SOUND_RE.test(trimmed)) return "sound";
  if (TRANSITION_RE.test(trimmed) && isAllCaps(trimmed) && trimmed.length > 3) {
    return "transition";
  }
  if (
    trimmed.startsWith("(") &&
    (context.previous === "character" ||
      context.previous === "dialogue" ||
      context.previous === "parenthetical")
  ) {
    return "parenthetical";
  }
  if (isAllCaps(trimmed) && context.previousBlank && trimmed.length > 1) {
    return "character";
  }
  if (
    trimmed.length > 0 &&
    (context.previous === "character" ||
      context.previous === "parenthetical" ||
      context.previous === "dialogue")
  ) {
    return "dialogue";
  }
  return "action";
}

/** Classify a whole document (used by the export flattening). */
function inferElements(lines) {
  const result = [];
  let previous = null;
  let previousBlank = true;

  for (const line of lines) {
    if (line.trim().length === 0) {
      result.push("action");
      previous = null;
      previousBlank = true;
      continue;
    }
    const element = inferElement(line, { previous, previousBlank });
    result.push(element);
    previous = element;
    previousBlank = false;
  }
  return result;
}

/* --------------------------------------------------------------------
 * Comic script model (SPEC §8.2, ported from v1 engines/comic).
 * A page block holds numbered panels; each panel holds DESCRIPTION,
 * DIALOGUE (character-tagged), SFX, and ART NOTES sub-fields.
 * -------------------------------------------------------------------- */

const PAGE_RE = /^PAGE\s+(\S+)/i;
const PANEL_RE = /^PANEL\s+(\S+)/i;
const DESCRIPTION_RE = /^DESCRIPTION:\s*/i;
const DIALOGUE_RE = /^DIALOGUE:\s*([^:]+):\s*/i;
const SFX_RE = /^SFX:\s*/i;
const ART_NOTES_RE = /^ART NOTES:\s*/i;

function appendText(current, line) {
  return current.length === 0 ? line.trim() : `${current} ${line.trim()}`;
}

/** Parse a comic script document into pages and panels. */
function parseComicDoc(text) {
  const pages = [];
  let page = null;
  let panel = null;
  let section = "description";
  let lastDialogue = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();

    const pageMatch = PAGE_RE.exec(line);
    if (pageMatch) {
      page = { number: pageMatch[1], panels: [] };
      pages.push(page);
      panel = null;
      section = "description";
      lastDialogue = null;
      continue;
    }

    const panelMatch = PANEL_RE.exec(line);
    if (panelMatch) {
      if (!page) {
        page = { number: "1", panels: [] };
        pages.push(page);
      }
      panel = {
        number: panelMatch[1],
        description: "",
        dialogue: [],
        sfx: [],
        artNotes: [],
      };
      page.panels.push(panel);
      section = "description";
      lastDialogue = null;
      continue;
    }

    if (!panel) continue;
    if (line.length === 0) continue;

    const descMatch = DESCRIPTION_RE.exec(line);
    if (descMatch) {
      section = "description";
      panel.description = appendText(
        panel.description,
        line.slice(descMatch[0].length),
      );
      lastDialogue = null;
      continue;
    }
    const dialogueMatch = DIALOGUE_RE.exec(line);
    if (dialogueMatch) {
      section = "dialogue";
      lastDialogue = {
        character: dialogueMatch[1].trim(),
        text: line.slice(dialogueMatch[0].length).trim(),
      };
      panel.dialogue.push(lastDialogue);
      continue;
    }
    const sfxMatch = SFX_RE.exec(line);
    if (sfxMatch) {
      section = "sfx";
      panel.sfx.push(line.slice(sfxMatch[0].length).trim());
      lastDialogue = null;
      continue;
    }
    const artMatch = ART_NOTES_RE.exec(line);
    if (artMatch) {
      section = "artNotes";
      panel.artNotes.push(line.slice(artMatch[0].length).trim());
      lastDialogue = null;
      continue;
    }

    // Continuation of the current section.
    if (section === "description") {
      panel.description = appendText(panel.description, line);
    } else if (section === "dialogue" && lastDialogue) {
      lastDialogue.text = appendText(lastDialogue.text, line);
    } else if (section === "sfx") {
      panel.sfx.push(line);
    } else {
      panel.artNotes.push(line);
    }
  }

  return { pages };
}

/* --------------------------------------------------------------------
 * Story-graph file format (SPEC §6.3, ported from v1 engines/
 * storygraph): `graph.json` at the project root; each node's prose
 * lives in its own markdown file, addressed project-relative.
 * -------------------------------------------------------------------- */

function createEmptyGraph() {
  return { nodes: [], edges: [], flags: [] };
}

function parseGraphNode(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.file !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    title: raw.title,
    file: raw.file,
    x: typeof raw.x === "number" ? raw.x : 0,
    y: typeof raw.y === "number" ? raw.y : 0,
  };
}

function parseGraphEdge(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  if (typeof raw.from !== "string" || typeof raw.to !== "string") return null;
  const edge = { from: raw.from, to: raw.to };
  if (typeof raw.label === "string") edge.label = raw.label;
  if (typeof raw.condition === "string") edge.condition = raw.condition;
  return edge;
}

/** Tolerant parse: junk in, empty graph out (never lose the file's words). */
function parseGraph(raw) {
  if (typeof raw !== "object" || raw === null) return createEmptyGraph();
  const nodes = Array.isArray(raw.nodes)
    ? raw.nodes.map(parseGraphNode).filter((node) => node !== null)
    : [];
  const edges = Array.isArray(raw.edges)
    ? raw.edges.map(parseGraphEdge).filter((edge) => edge !== null)
    : [];
  const flags = Array.isArray(raw.flags)
    ? raw.flags.filter((flag) => typeof flag === "string")
    : [];
  return { nodes, edges, flags };
}

/** Pretty-printed with stable key order — diffs cleanly in git (§6.3). */
function serializeGraph(graph) {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

/* --------------------------------------------------------------------
 * Screenplay export formats (v1 engines/script/src/export-formats.ts):
 * industry PDF HTML, Fountain, Final Draft FDX, plain text.
 * -------------------------------------------------------------------- */

function flattenScreenplay(sections) {
  const out = [];
  for (const [index, section] of sections.entries()) {
    if (index > 0) {
      out.push({ element: "action", text: "" });
    }
    const lines = section.body.split("\n");
    const elements = inferElements(lines);
    for (const [i, line] of lines.entries()) {
      out.push({ element: elements[i] ?? "action", text: line });
    }
  }
  return out;
}

/** Fountain serialization (SPEC §10): standard markers, transitions with >. */
function toFountain(input) {
  const lines = [`Title: ${input.projectName}`, ""];
  for (const item of flattenScreenplay(input.sections)) {
    if (item.element === "transition" && item.text.trim().length > 0) {
      lines.push(`> ${item.text.trim()}`);
    } else if (item.element === "parenthetical") {
      lines.push(item.text.trim());
    } else {
      lines.push(item.text);
    }
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

const FDX_TYPES = {
  "scene-heading": "Scene Heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
  song: "Action",
  sound: "Sound",
};

/** Final Draft FDX (SPEC §10). */
function toFdx(input) {
  const paragraphs = flattenScreenplay(input.sections)
    .map(
      (item) =>
        `    <Paragraph Type="${FDX_TYPES[item.element]}"><Text>${escapeXml(
          item.text,
        )}</Text></Paragraph>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${paragraphs}
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>${escapeXml(input.projectName)}</Text></Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>
`;
}

/** Plain text: the screenplay as-is, sections separated. */
function toPlainText(input) {
  return `${input.projectName.toUpperCase()}\n\n${input.sections
    .map((section) => section.body.trim())
    .join("\n\n")}\n`;
}

/**
 * Industry screenplay HTML for PDF (SPEC §10): Courier Prime 12, 1.5"
 * left margin, element indents (character 2.2", dialogue 1"/2",
 * parenthetical 1.6", transitions flush right). Print-document colors
 * are part of the format, not app UI — byte-stable golden output.
 */
function toScreenplayHtml(input) {
  const body = flattenScreenplay(input.sections)
    .map((item) => {
      const text = escapeXml(item.text);
      switch (item.element) {
        case "scene-heading":
          return `<p class="scene">${text.toUpperCase()}</p>`;
        case "character":
          return `<p class="character">${text}</p>`;
        case "dialogue":
          return `<p class="dialogue">${text}</p>`;
        case "parenthetical":
          return `<p class="paren">${text}</p>`;
        case "transition":
          return `<p class="transition">${text}</p>`;
        case "song":
        case "sound":
          return `<p class="cue">${text}</p>`;
        default:
          return text.trim().length === 0
            ? `<p class="action">&nbsp;</p>`
            : `<p class="action">${text}</p>`;
      }
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(input.projectName)}</title>
<style>
  @page { size: Letter; margin: 1in 1in 1in 1.5in; }
  body { font-family: "Courier Prime", "Courier New", monospace; font-size: 12pt; line-height: 1.0; color: #000; }
  p { margin: 0; }
  .scene { font-weight: bold; margin-top: 2em; }
  .character { margin-left: 2.2in; margin-top: 1em; }
  .dialogue { margin-left: 1.0in; margin-right: 2.0in; }
  .paren { margin-left: 1.6in; }
  .transition { text-align: right; margin-top: 1em; }
  .cue { margin-left: 1.0in; font-style: italic; }
  .title-page { text-align: center; margin-top: 3in; }
</style>
</head>
<body>
<p class="title-page">${escapeXml(input.projectName.toUpperCase())}</p>
${body}
</body>
</html>
`;
}

/* --------------------------------------------------------------------
 * Comic export formats (v1 engines/comic/src/export-formats.ts):
 * industry-styled comic script PDF (via print-clean HTML) and canonical
 * text. (v1 also had docx; in v2 the universal exporter covers Word.)
 * -------------------------------------------------------------------- */

function comicPageToText(page) {
  const parts = [`PAGE ${page.number}`];
  for (const panel of page.panels) {
    parts.push(comicPanelToText(panel));
  }
  return parts.join("\n\n");
}

function comicPanelToText(panel) {
  const parts = [`PANEL ${panel.number}`];
  if (panel.description) parts.push(`DESCRIPTION: ${panel.description}`);
  for (const line of panel.dialogue) {
    parts.push(`DIALOGUE: ${line.character}: ${line.text}`);
  }
  for (const sfx of panel.sfx) {
    parts.push(`SFX: ${sfx}`);
  }
  for (const note of panel.artNotes) {
    parts.push(`ART NOTES: ${note}`);
  }
  return parts.join("\n");
}

/** Canonical comic-script text. */
function toComicScriptText(input) {
  const pages = input.sections.flatMap(
    (section) => parseComicDoc(section.body).pages,
  );
  return `${input.projectName.toUpperCase()}\n\n${pages
    .map(comicPageToText)
    .join("\n\n---\n\n")}\n`;
}

/** Comic script PDF HTML: page rules, panel numbers, label styling (§10). */
function toComicScriptHtml(input) {
  const pages = input.sections.flatMap(
    (section) => parseComicDoc(section.body).pages,
  );
  const body = pages
    .map(
      (page) => `
  <section class="page">
    <h1>PAGE ${escapeXml(page.number)}</h1>
    ${page.panels
      .map(
        (panel) => `
    <div class="panel">
      <p class="panel-num">PANEL ${escapeXml(panel.number)}</p>
      ${
        panel.description
          ? `<p class="label"><span>DESCRIPTION:</span> ${escapeXml(
              panel.description,
            )}</p>`
          : ""
      }
      ${panel.dialogue
        .map(
          (line) =>
            `<p class="label"><span>DIALOGUE:</span> <strong>${escapeXml(
              line.character,
            )}:</strong> ${escapeXml(line.text)}</p>`,
        )
        .join("\n")}
      ${panel.sfx
        .map(
          (sfx) => `<p class="label"><span>SFX:</span> ${escapeXml(sfx)}</p>`,
        )
        .join("\n")}
      ${panel.artNotes
        .map(
          (note) =>
            `<p class="label note"><span>ART NOTES:</span> ${escapeXml(
              note,
            )}</p>`,
        )
        .join("\n")}
    </div>`,
      )
      .join("\n")}
  </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(input.projectName)}</title>
<style>
  @page { size: Letter; margin: 1in; }
  body { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
  h1 { font-size: 14pt; border-bottom: 2px solid #111; padding-bottom: 4pt; margin: 18pt 0 10pt; }
  .panel { margin: 0 0 12pt 12pt; }
  .panel-num { font-weight: bold; margin: 0 0 4pt; }
  .label { margin: 0 0 4pt 16pt; }
  .label span { font-size: 9pt; letter-spacing: 0.06em; color: #555; }
  .note { font-style: italic; }
  .title { text-align: center; font-size: 18pt; margin: 2in 0 1in; }
</style>
</head>
<body>
<p class="title">${escapeXml(input.projectName.toUpperCase())}</p>
${body}
</body>
</html>
`;
}

/* --------------------------------------------------------------------
 * Story-graph export formats (v1 engines/storygraph/src/export-formats.
 * ts): Ren'Py skeleton, Twee 3, outline PDF HTML. Pure and
 * deterministic — golden-file tested in v1, byte-stable here too.
 *
 * GM-only nodes (TTRPG preset's `visibility: gm` frontmatter) are
 * filtered before building this input; edges into removed nodes are
 * dropped here so player-facing outputs never leak them.
 * -------------------------------------------------------------------- */

function visibleGraphEdges(input, fromId) {
  const visible = new Set(input.nodes.map((node) => node.id));
  return input.graph.edges.filter(
    (edge) => edge.from === fromId && visible.has(edge.to),
  );
}

function graphNodeTitle(input, id) {
  return input.nodes.find((node) => node.id === id)?.title ?? id;
}

/** Flatten light markdown so a prose line can act as a dialogue line. */
function stripMarkdown(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\[\[([^\]|]*)\|([^\]|]*)\]\]/g, "$2")
    .replace(/\[\[([^\]|]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .trim();
}

/** Ren'Py label/menu/jump skeleton (SPEC §10 — limits documented inline). */
function toRenpySkeleton(input) {
  const label = (id) => `nod_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
  const lines = [
    `# ${input.projectName} — Ren'Py skeleton exported from Edenwright`,
    "# Structure only: labels, menus, jumps, and plain dialogue lines.",
    "# Flag conditions arrive as comments; wire them to Ren'Py variables yourself.",
    "",
  ];
  const first = input.nodes[0];
  if (first) {
    lines.push("label start:", `    jump ${label(first.id)}`, "");
  }
  for (const node of input.nodes) {
    lines.push(`label ${label(node.id)}:`);
    const prose = node.body
      .split("\n")
      .map((line) => stripMarkdown(line))
      .filter((line) => line.length > 0);
    const outgoing = visibleGraphEdges(input, node.id);
    for (const line of prose) {
      lines.push(`    "${line.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    }
    if (outgoing.length === 0) {
      lines.push(prose.length === 0 ? "    pass" : "    return");
    } else if (outgoing.length === 1 && !outgoing[0].label) {
      const edge = outgoing[0];
      if (edge.condition) lines.push(`    # condition: ${edge.condition}`);
      lines.push(`    jump ${label(edge.to)}`);
    } else {
      lines.push("    menu:");
      for (const edge of outgoing) {
        if (edge.condition)
          lines.push(`        # condition: ${edge.condition}`);
        const choice = (edge.label ?? graphNodeTitle(input, edge.to)).replace(
          /"/g,
          '\\"',
        );
        lines.push(
          `        "${choice}":`,
          `            jump ${label(edge.to)}`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Deterministic IFID (UUID-shaped) so Twee output stays golden-testable. */
function storyIfid(projectName) {
  const fnv1a = (text) => {
    let hash = 0x811c9dc5;
    for (const char of text) {
      hash ^= char.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").toUpperCase();
  };
  const a = fnv1a(projectName);
  const b = fnv1a(`${projectName}#1`);
  const c = fnv1a(`${projectName}#2`);
  const d = fnv1a(`${projectName}#3`);
  return `${a}-${b.slice(0, 4)}-${b.slice(4)}-${c.slice(0, 4)}-${c.slice(
    4,
  )}${d}`;
}

/** Twee 3 notation (SPEC §10) — passages carry their canvas position. */
function toTwee(input) {
  const used = new Set();
  const names = new Map();
  for (const node of input.nodes) {
    const base =
      node.title.replace(/[[\]{}]/g, "-").trim() || `node-${node.id}`;
    const name = used.has(base) ? `${base} (${node.id})` : base;
    used.add(name);
    names.set(node.id, name);
  }

  const first = input.nodes[0];
  const parts = [
    `:: StoryTitle\n${input.projectName}\n`,
    `:: StoryData\n${JSON.stringify(
      {
        ifid: storyIfid(input.projectName),
        format: "SugarCube",
        "format-version": "2.36.1",
        ...(first ? { start: names.get(first.id) } : {}),
      },
      null,
      2,
    )}\n`,
  ];
  for (const node of input.nodes) {
    const name = names.get(node.id) ?? node.title;
    const outgoing = visibleGraphEdges(input, node.id);
    const links = outgoing
      .map((edge) => {
        const target = names.get(edge.to) ?? edge.to;
        return edge.label ? `[[${edge.label}->${target}]]` : `[[${target}]]`;
      })
      .join("\n");
    const body = [node.body.trim(), links].filter(Boolean).join("\n\n");
    parts.push(
      `:: ${name} {"position":"${Math.round(node.x)},${Math.round(
        node.y,
      )}"}\n${body}\n`,
    );
  }
  return `${parts.join("\n")}\n`;
}

function graphChoiceText(input, fromId) {
  return visibleGraphEdges(input, fromId).map((edge) => {
    const target = graphNodeTitle(input, edge.to);
    const label = edge.label ? `${edge.label} → ${target}` : `→ ${target}`;
    return edge.condition ? `${label} (if ${edge.condition})` : label;
  });
}

/** Print-clean outline HTML for the shell's printToPDF. */
function toOutlineHtml(input) {
  const sections = input.nodes
    .map((node) => {
      const choices = graphChoiceText(input, node.id);
      const choicesHtml =
        choices.length > 0
          ? `    <p class="choices">${choices.map(escapeXml).join("<br/>")}</p>\n`
          : "";
      return `  <section>
    <h2>${escapeXml(node.title)}</h2>
    ${markdownToHtml(node.body)}
${choicesHtml}  </section>`;
    })
    .join("\n<hr/>\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(input.projectName)} — outline</title>
<style>
  @page { size: Letter; margin: 1in; }
  body { font-family: "Literata", Georgia, serif; font-size: 11pt; line-height: 1.6; color: #111; }
  h1 { text-align: center; font-size: 18pt; margin: 0 0 28pt; }
  h2 { font-size: 14pt; margin: 0 0 8pt; }
  hr { border: none; border-top: 1px solid #999; margin: 18pt auto; width: 40%; }
  .choices { font-style: italic; color: #333; border-left: 2px solid #999; padding-left: 10pt; }
  blockquote { border-left: 2px solid #999; padding-left: 12pt; color: #444; }
  pre { font-family: monospace; background: #f4f4f4; padding: 8pt; }
</style>
</head>
<body>
  <h1>${escapeXml(input.projectName)}</h1>
${sections}
</body>
</html>
`;
}

/* --------------------------------------------------------------------
 * The three medium exporters (SPEC v2 §5): screenplay, comic,
 * interactive. Gated by medium tag so each appears only in matching
 * projects' export dialogs (§4.2).
 * -------------------------------------------------------------------- */

const screenplayExporter = {
  id: "lablooms.medium-exporters:screenplay",
  name: "Screenplay exports",
  description:
    "Industry screenplay PDF, Fountain, Final Draft FDX, plain text.",
  media: ["screenplay"],
  formats: [
    { id: "pdf", label: "Industry PDF (.pdf)", fileExtension: "pdf" },
    {
      id: "fountain",
      label: "Fountain (.fountain)",
      fileExtension: "fountain",
    },
    { id: "fdx", label: "Final Draft (.fdx)", fileExtension: "fdx" },
    { id: "text", label: "Plain text (.txt)", fileExtension: "txt" },
  ],
  async run(format, context) {
    const sections = await collectSections(context.fs, context.projectPath);
    const projectName = projectNameOf(context.projectPath);
    const input = { projectName, sections };
    const base = `${context.outputDir}/${sanitize(projectName)}`;

    switch (format) {
      case "pdf":
        await context.renderPdf(toScreenplayHtml(input), `${base}.pdf`);
        return;
      case "fountain":
        await context.fs.writeFile(`${base}.fountain`, toFountain(input));
        return;
      case "fdx":
        await context.fs.writeFile(`${base}.fdx`, toFdx(input));
        return;
      case "text":
        await context.fs.writeFile(`${base}.txt`, toPlainText(input));
        return;
      default:
        throw new Error(`Unknown screenplay export format: ${format}`);
    }
  },
};

const comicExporter = {
  id: "lablooms.medium-exporters:comic",
  name: "Comic exports",
  description: "Industry-styled comic script PDF and plain text.",
  media: ["comic"],
  formats: [
    { id: "pdf", label: "Comic script PDF (.pdf)", fileExtension: "pdf" },
    { id: "text", label: "Comic script text (.txt)", fileExtension: "txt" },
  ],
  async run(format, context) {
    const sections = await collectSections(context.fs, context.projectPath);
    const projectName = projectNameOf(context.projectPath);
    const input = { projectName, sections };
    const base = `${context.outputDir}/${sanitize(projectName)}`;

    switch (format) {
      case "pdf":
        await context.renderPdf(toComicScriptHtml(input), `${base}.pdf`);
        return;
      case "text":
        await context.fs.writeFile(`${base}.txt`, toComicScriptText(input));
        return;
      default:
        throw new Error(`Unknown comic export format: ${format}`);
    }
  },
};

const interactiveExporter = {
  id: "lablooms.medium-exporters:interactive",
  name: "Interactive exports",
  description: "Ren'Py skeleton, Twee 3, outline PDF, JSON dump of the graph.",
  media: ["interactive"],
  formats: [
    { id: "rpy", label: "Ren'Py skeleton (.rpy)", fileExtension: "rpy" },
    { id: "tw", label: "Twee 3 (.tw)", fileExtension: "tw" },
    { id: "pdf", label: "Outline PDF (.pdf)", fileExtension: "pdf" },
    { id: "json", label: "JSON dump (.json)", fileExtension: "json" },
  ],
  async run(format, context) {
    const graphPath = `${context.projectPath}/graph.json`;
    const graph = (await context.fs.exists(graphPath))
      ? parseGraph(JSON.parse(await context.fs.readFile(graphPath)))
      : parseGraph(null);

    const nodes = [];
    for (const node of graph.nodes) {
      const filePath = `${context.projectPath}/${node.file}`;
      if (!(await context.fs.exists(filePath))) continue;
      const parsed = parseFrontmatter(await context.fs.readFile(filePath));
      // GM-only nodes stay in the JSON dump but leave player-facing outputs.
      if (format !== "json" && parsed.data.visibility === "gm") continue;
      nodes.push({
        id: node.id,
        title: node.title,
        x: node.x,
        y: node.y,
        body: parsed.body,
      });
    }

    const projectName = projectNameOf(context.projectPath);
    const input = { projectName, graph, nodes };
    const base = `${context.outputDir}/${sanitize(projectName)}`;

    switch (format) {
      case "rpy":
        await context.fs.writeFile(`${base}.rpy`, toRenpySkeleton(input));
        return;
      case "tw":
        await context.fs.writeFile(`${base}.tw`, toTwee(input));
        return;
      case "pdf":
        await context.renderPdf(toOutlineHtml(input), `${base}-outline.pdf`);
        return;
      case "json":
        await context.fs.writeFile(`${base}-graph.json`, serializeGraph(graph));
        return;
      default:
        throw new Error(`Unknown interactive export format: ${format}`);
    }
  },
};

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    ctx.exporters.register(screenplayExporter);
    ctx.exporters.register(comicExporter);
    ctx.exporters.register(interactiveExporter);
  },
});
