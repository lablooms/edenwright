/**
 * Screenplay Mode — the v1 Script engine's editor mode as a community plugin.
 * Ported from v1 engines/script/src/screenplay.ts + screenplay-model.ts.
 * Element inference and key flow are unchanged; the CM theme became
 * styles.css (CSS injection is the v2 way).
 */
const { definePlugin } = require("@edenwright/plugin-api");
const {
  RangeSetBuilder,
  StateEffect,
  StateField,
} = require("@codemirror/state");
const {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  showPanel,
} = require("@codemirror/view");

/* ------------------------------------------------------------------ */
/* Element model (v1 screenplay-model.ts) — pure logic, no CM imports. */
/* Elements: Scene Heading → Action → Character → Dialogue →           */
/* Parenthetical → Transition, plus SONG and SOUND cues for            */
/* musical/audio presets.                                              */
/* ------------------------------------------------------------------ */

const ELEMENT_CYCLE = [
  "scene-heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
];

/** What Enter sets the *next* line to, per current element. */
const ENTER_FLOW = {
  "scene-heading": "action",
  action: "action",
  character: "dialogue",
  dialogue: "action",
  parenthetical: "dialogue",
  transition: "scene-heading",
  song: "action",
  sound: "action",
};

function nextElement(current) {
  const index = ELEMENT_CYCLE.indexOf(current);
  return ELEMENT_CYCLE[(index + 1) % ELEMENT_CYCLE.length];
}

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

/* ------------------------------------------------------------------ */
/* Editor mode (v1 screenplay.ts): Courier page, Tab cycles elements,  */
/* Enter flows them, ≈ minutes per page. Explicit overrides (from      */
/* Tab/Enter) win over content inference.                              */
/* ------------------------------------------------------------------ */

const setElementEffect = StateEffect.define();

/** Element overrides keyed by line start position, mapped through edits. */
const elementOverrides = StateField.define({
  create: () => new Map(),
  update(overrides, transaction) {
    if (!transaction.docChanged && transaction.effects.length === 0) {
      return overrides;
    }
    const next = new Map();
    if (transaction.docChanged) {
      for (const [from, element] of overrides) {
        // assoc -1: typing at line start must keep the key at line start.
        next.set(transaction.changes.mapPos(from, -1), element);
      }
    } else {
      for (const [from, element] of overrides) {
        next.set(from, element);
      }
    }
    for (const effect of transaction.effects) {
      if (effect.is(setElementEffect)) {
        if (effect.value.element) {
          next.set(effect.value.lineFrom, effect.value.element);
        } else {
          next.delete(effect.value.lineFrom);
        }
      }
    }
    return next;
  },
});

function elementFor(view, lineNumber, context) {
  const line = view.state.doc.line(lineNumber);
  const override = view.state.field(elementOverrides).get(line.from);
  if (override) return override;
  return inferElement(line.text, context);
}

function buildDecorations(view) {
  const items = [];
  let previous = null;
  let previousBlank = true;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.text.trim().length === 0) {
        // A blank line primed by Enter-flow keeps its element (and its class).
        const override = view.state.field(elementOverrides).get(line.from);
        if (override) {
          items.push({
            from: line.from,
            to: line.from,
            deco: Decoration.line({ class: `cm-ew-scr-${override}` }),
          });
          previous = override;
          previousBlank = false;
        } else {
          previous = null;
          previousBlank = true;
        }
        pos = line.to + 1;
        continue;
      }
      const element = elementFor(view, line.number, {
        previous,
        previousBlank,
      });
      items.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: `cm-ew-scr-${element}` }),
      });
      previous = element;
      previousBlank = false;
      pos = line.to + 1;
    }
  }

  const builder = new RangeSetBuilder();
  for (const item of items) builder.add(item.from, item.to, item.deco);
  return builder.finish();
}

const screenplayDecorations = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }

    update(update) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.state.field(elementOverrides) !==
          update.startState.field(elementOverrides)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function currentElement(view) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const overrides = view.state.field(elementOverrides);
  const override = overrides.get(line.from);
  if (override) return { lineFrom: line.from, element: override };

  // Reconstruct context for inference.
  let previous = null;
  let previousBlank = true;
  for (let n = 1; n < line.number; n += 1) {
    const text = view.state.doc.line(n).text;
    if (text.trim().length === 0) {
      previous = null;
      previousBlank = true;
    } else {
      previous =
        overrides.get(view.state.doc.line(n).from) ??
        inferElement(text, { previous, previousBlank });
      previousBlank = false;
    }
  }
  return {
    lineFrom: line.from,
    element: inferElement(line.text, { previous, previousBlank }),
  };
}

const cycleElementKeymap = {
  key: "Tab",
  run: (view) => {
    const { lineFrom, element } = currentElement(view);
    view.dispatch({
      effects: setElementEffect.of({
        lineFrom,
        element: nextElement(element),
      }),
    });
    return true;
  },
};

const flowEnterKeymap = {
  key: "Enter",
  run: (view) => {
    const { element } = currentElement(view);
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const insert = "\n";
    const newLineFrom = head + insert.length;
    // Only flow at end of line; mid-line splits stay plain.
    if (head !== line.to) return false;
    view.dispatch({
      changes: { from: head, insert },
      selection: { anchor: newLineFrom },
      effects: setElementEffect.of({
        lineFrom: newLineFrom,
        element: ENTER_FLOW[element],
      }),
      userEvent: "input",
    });
    return true;
  },
};

function minutePanel(view) {
  const dom = document.createElement("div");
  dom.className = "cm-ew-screenplay-minutes";
  const render = () => {
    // Industry rough cut: a screenplay page ≈ a minute ≈ 55 lines (§8.3).
    const minutes = Math.max(1, Math.round(view.state.doc.lines / 55));
    dom.textContent = `≈ ${minutes} min`;
  };
  render();
  return {
    dom,
    update() {
      render();
    },
  };
}

/** The screenplay editor mode, as one medium-scoped extension. */
function screenplayMode() {
  return [
    elementOverrides,
    screenplayDecorations,
    keymap.of([cycleElementKeymap, flowEnterKeymap]),
    showPanel.of(minutePanel),
    // The v1 CM theme is styles.css now; this marker class scopes those
    // rules to screenplay editors only — plugin CSS loads app-wide. (It's a
    // Facet, not a function — see @codemirror/view docs.)
    EditorView.editorAttributes.of({ class: "cm-ew-screenplay" }),
  ];
}

module.exports = definePlugin({
  manifest: require("./manifest.json"),
  onload(ctx) {
    ctx.editor.registerExtension((context) =>
      context.medium === "screenplay" ? screenplayMode() : null,
    );
  },
});
