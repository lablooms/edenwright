/**
 * Comic Rail (SPEC §8.2) — the page-flow rail for comic scripts, ported from
 * the v1 comic engine into a self-contained community plugin: PAGE/PANEL
 * editor decorations for `medium === "comic"` files, the page-flow rail view
 * (storyboard + RTL toggles), and the insert page/panel commands.
 *
 * Community plugins may only require the plugin API, the app's own
 * @codemirror/* instances, and their manifest — so the parser and live store
 * below are inlined from the v1 engine sources. Views are vanilla DOM (the
 * engine used React; plugins may not). Comments keep the engine's habit of
 * explaining why, not what.
 */

const { definePlugin } = require("@edenwright/plugin-api");
const { RangeSetBuilder } = require("@codemirror/state");
const { Decoration, EditorView, ViewPlugin } = require("@codemirror/view");

/** Tiny element factory: views build DOM by hand, user text via textContent. */
function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ */
/* Comic script model (SPEC §8.2) — pure parsing, ported verbatim. A   */
/* page block holds numbered panels; each panel holds DESCRIPTION,     */
/* DIALOGUE (character-tagged), SFX, and ART NOTES sub-fields.         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Shared per-plugin state: the comic editor extension publishes the   */
/* live document; the flow-rail view and the insert commands consume   */
/* it. (Same bundle, one app — the plugin API has no "current editor"  */
/* query yet.) Rail UI state is session-only — golden rule 2.          */
/* ------------------------------------------------------------------ */

let liveState = {
  doc: "",
  view: null,
  rtl: false,
  thumbnails: false,
};

const liveListeners = new Set();

function notifyLive() {
  for (const listener of liveListeners) listener();
}

function setLiveDoc(doc, view) {
  liveState = { ...liveState, doc, view };
  notifyLive();
}

function setRailOptions(options) {
  liveState = { ...liveState, ...options };
  notifyLive();
}

function getLiveState() {
  return liveState;
}

function subscribeLive(listener) {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ */
/* Comic script editor decorations (SPEC §8.2): PAGE blocks separated  */
/* with a rule, PANEL numbers in leaf, sub-field labels quiet. Theme   */
/* rules moved to styles.css under `.ew-comic-editor`.                 */
/* ------------------------------------------------------------------ */

function buildComicDecorations(view) {
  const items = [];

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text.trim();

      if (PAGE_RE.test(text)) {
        items.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ class: "cm-ew-comic-page" }),
        });
      } else if (PANEL_RE.test(text)) {
        items.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ class: "cm-ew-comic-panel" }),
        });
      } else if (
        DESCRIPTION_RE.test(text) ||
        DIALOGUE_RE.test(text) ||
        SFX_RE.test(text) ||
        ART_NOTES_RE.test(text)
      ) {
        items.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ class: "cm-ew-comic-label" }),
        });
      }

      pos = line.to + 1;
    }
  }

  const builder = new RangeSetBuilder();
  for (const item of items) builder.add(item.from, item.to, item.deco);
  return builder.finish();
}

const comicDecorations = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildComicDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildComicDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** Publish the live doc for the flow rail on every edit. */
function liveBridge() {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      setLiveDoc(update.state.doc.toString(), update.view);
    }
  });
}

/**
 * Tags the editor root so styles.css can scope the comic look to comic
 * editors only — an enabled plugin's stylesheet is global.
 */
function comicRootClass() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        view.dom.classList.add("ew-comic-editor");
      }

      destroy() {
        this.view.dom.classList.remove("ew-comic-editor");
      }
    },
  );
}

/** Publish the live doc on open, plus decorations and the scoping class. */
function comicMode() {
  const live = ViewPlugin.fromClass(
    class {
      constructor(view) {
        setLiveDoc(view.state.doc.toString(), view);
      }
    },
  );
  return [comicRootClass(), live, liveBridge(), comicDecorations];
}

/* ------------------------------------------------------------------ */
/* The page-flow rail (SPEC §8.2): page/panel rhythm at a glance, with */
/* a storyboard toggle (thumbnail placeholders per panel) and an RTL   */
/* toggle for manga reading direction. Vanilla rewrite of the v1 React */
/* component; re-renders on every live-store notification.             */
/* ------------------------------------------------------------------ */

function renderFlowRail(element) {
  const root = h("div", "ew-flow-rail");
  const toggles = h("div", "ew-flow-rail__toggles");
  const storyboardButton = h("button", "", "Storyboard");
  storyboardButton.type = "button";
  const rtlButton = h("button", "", "RTL");
  rtlButton.type = "button";
  rtlButton.title = "Right-to-left reading (manga)";
  toggles.append(storyboardButton, rtlButton);
  root.append(toggles);
  element.append(root);

  storyboardButton.addEventListener("click", () => {
    setRailOptions({ thumbnails: !getLiveState().thumbnails });
  });
  rtlButton.addEventListener("click", () => {
    setRailOptions({ rtl: !getLiveState().rtl });
  });

  function render() {
    const state = getLiveState();
    // Active state rides on data-active (styles.css), not on inline styles.
    storyboardButton.toggleAttribute("data-active", state.thumbnails);
    rtlButton.toggleAttribute("data-active", state.rtl);

    // Drop everything after the toggles bar, then rebuild from the doc.
    while (root.lastChild !== toggles) root.lastChild.remove();

    const doc = parseComicDoc(state.doc);
    const pages = state.rtl ? [...doc.pages].reverse() : doc.pages;

    if (pages.length === 0) {
      root.append(
        h(
          "p",
          "ew-flow-rail__empty",
          "No pages yet — a PAGE marker starts the rhythm.",
        ),
      );
      return;
    }

    for (const page of pages) {
      const section = h("section", "ew-flow-rail__page");
      const head = h(
        "header",
        "ew-flow-rail__page-head",
        `Page ${page.number}`,
      );
      head.append(
        h(
          "span",
          "ew-flow-rail__count",
          `${page.panels.length} ${page.panels.length === 1 ? "panel" : "panels"}`,
        ),
      );
      const panels = h("div", "ew-flow-rail__panels");
      for (const panel of page.panels) {
        if (state.thumbnails) {
          const thumb = h("div", "ew-flow-rail__thumb");
          thumb.append(h("span", "ew-flow-rail__thumb-num", panel.number));
          panels.append(thumb);
        } else {
          panels.append(h("span", "ew-flow-rail__chip", panel.number));
        }
      }
      section.append(head, panels);
      const tease = page.panels[0]?.description;
      if (tease) section.append(h("p", "ew-flow-rail__tease", tease));
      root.append(section);
    }
  }

  const unsubscribe = subscribeLive(render);
  render();
  return unsubscribe;
}

/* ------------------------------------------------------------------ */
/* Registrations.                                                       */
/* ------------------------------------------------------------------ */

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    ctx.editor.registerExtension((context) =>
      context.medium === "comic" ? comicMode() : null,
    );

    ctx.workspace.registerView({
      id: "comic-flow-rail",
      title: "Page flow",
      icon: "PanelsTopLeft",
      render: (element) => renderFlowRail(element),
    });
    ctx.workspace.registerRibbonItem({
      id: "comic-flow-rail-ribbon",
      icon: "PanelsTopLeft",
      title: "Page flow",
      location: "sidebar-top",
      onClick: () => ctx.workspace.openView("comic-flow-rail"),
    });

    ctx.commands.register({
      id: "comic:insert-page",
      name: "Comic: insert page",
      callback: () => {
        const { view, doc } = getLiveState();
        if (!view) return;
        const pageCount = (doc.match(/^PAGE\s/gm) ?? []).length;
        const head = view.state.selection.main.head;
        view.dispatch({
          changes: { from: head, insert: `\n\nPAGE ${pageCount + 1}\n\n` },
          selection: { anchor: head + 8 + String(pageCount + 1).length },
          userEvent: "input",
        });
      },
    });
    ctx.commands.register({
      id: "comic:insert-panel",
      name: "Comic: insert panel",
      callback: () => {
        const { view, doc } = getLiveState();
        if (!view) return;
        const panelCount = (doc.match(/^PANEL\s/gm) ?? []).length;
        const head = view.state.selection.main.head;
        const insert = `\nPANEL ${panelCount + 1}\nDESCRIPTION: \n`;
        view.dispatch({
          changes: { from: head, insert },
          selection: { anchor: head + insert.length - 1 },
          userEvent: "input",
        });
      },
    });
  },
});
