/**
 * Story Canvas (SPEC v2 §5): the story-graph node canvas over `graph.json`,
 * with pan/zoom and walk mode for proofreading routes. Ported from the v1
 * storygraph engine (engines/storygraph). The screenplay mode, comic rail,
 * and medium exporters live in their own seed plugins.
 *
 * Community plugins may only require the plugin API — so the graph model
 * and the tiny id/frontmatter helpers are inlined below.
 */

const { definePlugin } = require("@edenwright/plugin-api");

/* IDs live in frontmatter and never change on rename (SPEC §6.1). */
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function newId(prefix, length = 8) {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  let result = "";
  for (const value of values) {
    result += ID_ALPHABET[value % ID_ALPHABET.length];
  }
  return `${prefix}_${result}`;
}

/** Plain scalars when safe; JSON double-quotes are valid YAML otherwise. */
const yamlScalar = (value) =>
  /^[A-Za-z0-9 _-]+$/.test(value) ? value : JSON.stringify(value);

/** New node prose files open with frontmatter and one blank line, as v1. */
function serializeNodeFile(data) {
  const lines = Object.entries(data).map(
    ([key, value]) => `${key}: ${yamlScalar(String(value))}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/* ===========================================================================
 * The story-graph file format (ported from engines/storygraph/graph-model.ts):
 * `graph.json` at the eden root; each node's prose lives in its own
 * eden-relative markdown file.
 * ======================================================================== */

function createEmptyGraph() {
  return { nodes: [], edges: [], flags: [] };
}

function parseNode(raw) {
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

function parseEdge(raw) {
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
    ? raw.nodes.map(parseNode).filter((n) => n !== null)
    : [];
  const edges = Array.isArray(raw.edges)
    ? raw.edges.map(parseEdge).filter((e) => e !== null)
    : [];
  const flags = Array.isArray(raw.flags)
    ? raw.flags.filter((f) => typeof f === "string")
    : [];
  return { nodes, edges, flags };
}

/** Pretty-printed with stable key order — diffs cleanly in git (§6.3). */
function serializeGraph(graph) {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

function addNode(graph, node) {
  if (graph.nodes.some((existing) => existing.id === node.id)) {
    throw new Error(`Duplicate node id: ${node.id}`);
  }
  return { ...graph, nodes: [...graph.nodes, node] };
}

function moveNode(graph, id, x, y) {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === id ? { ...node, x, y } : node,
    ),
  };
}

/** A free spot for a new node: right of the rightmost, at the top row. */
function nextNodePosition(graph) {
  if (graph.nodes.length === 0) return { x: 40, y: 40 };
  const maxX = Math.max(...graph.nodes.map((node) => node.x));
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  return { x: maxX + 200, y: minY };
}

/* ---------------------------------------------------------------------------
 * The story-graph canvas (ported from engines/storygraph/graph-view.tsx,
 * React → vanilla SVG): pan/zoom node canvas + walk mode.
 *
 * v1 stored eden-relative paths in node.file, which its own exporter could
 * never resolve (it joins projectPath + file). Here node.file stays
 * eden-relative — one eden = one story, and graph.json sits at the eden root.
 * ------------------------------------------------------------------------ */

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const GRAPH_PATH = "graph.json";

/** The eden's graph.json, creating an empty one when the preset didn't. */
async function ensureGraph(ctx) {
  if (!(await ctx.eden.fs.exists(GRAPH_PATH))) {
    await ctx.eden.fs.writeFile(GRAPH_PATH, serializeGraph(createEmptyGraph()));
  }
  return { graphPath: GRAPH_PATH };
}

function renderGraphView(ctx, element) {
  let graph = null;
  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let walkId = null;
  let drag = null;
  let panDrag = null;
  let disposed = false;

  const root = document.createElement("div");
  root.className = "ew-graph";
  element.appendChild(root);

  const toolbar = document.createElement("div");
  toolbar.className = "ew-graph__toolbar";
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Add node";
  const walkButton = document.createElement("button");
  walkButton.type = "button";
  walkButton.textContent = "Walk";
  const zoomLabel = document.createElement("span");
  zoomLabel.className = "ew-graph__zoom";
  toolbar.append(addButton, walkButton, zoomLabel);

  const canvas = document.createElement("div");
  canvas.className = "ew-graph__canvas";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ew-graph__edges");
  canvas.appendChild(svg);

  root.append(toolbar, canvas);

  // Node buttons are pooled by id so an in-progress drag survives re-renders.
  const nodeEls = new Map();
  let hint = null;
  let walkPanel = null;

  const persist = async (next) => {
    graph = next;
    await ctx.eden.fs.writeFile(GRAPH_PATH, serializeGraph(next));
  };

  const renderGraph = () => {
    if (disposed || !graph) return;

    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    walkButton.disabled = graph.nodes.length === 0;
    if (walkId !== null) {
      walkButton.dataset.active = "";
    } else {
      walkButton.removeAttribute("data-active");
    }

    if (graph.nodes.length === 0 && !hint) {
      hint = document.createElement("p");
      hint.className = "ew-graph__hint";
      hint.textContent = "Empty canvas — Add node plants the first one.";
      canvas.appendChild(hint);
    } else if (graph.nodes.length > 0 && hint) {
      hint.remove();
      hint = null;
    }

    // Edges carry no listeners — rebuilt wholesale on every render.
    svg.replaceChildren();
    for (const edge of graph.edges) {
      const from = graph.nodes.find((node) => node.id === edge.from);
      const to = graph.nodes.find((node) => node.id === edge.to);
      if (!from || !to) continue;
      const x1 = (from.x + NODE_WIDTH / 2) * zoom + pan.x;
      const y1 = (from.y + NODE_HEIGHT / 2) * zoom + pan.y;
      const x2 = (to.x + NODE_WIDTH / 2) * zoom + pan.x;
      const y2 = (to.y + NODE_HEIGHT / 2) * zoom + pan.y;
      const group = document.createElementNS(SVG_NS, "g");
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("class", "ew-graph__edge");
      group.appendChild(line);
      if (edge.label) {
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", String((x1 + x2) / 2));
        label.setAttribute("y", String((y1 + y2) / 2 - 4));
        label.setAttribute("class", "ew-graph__edge-label");
        label.textContent = edge.label;
        group.appendChild(label);
      }
      svg.appendChild(group);
    }

    const seen = new Set();
    for (const node of graph.nodes) {
      seen.add(node.id);
      let el = nodeEls.get(node.id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "ew-graph__node";
        // Capture the id, not the node — positions go stale every moveNode.
        el.addEventListener("pointerdown", (event) =>
          onNodePointerDown(event, node.id),
        );
        nodeEls.set(node.id, el);
        canvas.appendChild(el);
      }
      el.textContent = node.title;
      el.title = node.file;
      el.style.left = `${node.x * zoom + pan.x}px`;
      el.style.top = `${node.y * zoom + pan.y}px`;
      el.style.width = `${NODE_WIDTH * zoom}px`;
      el.style.minHeight = `${NODE_HEIGHT * zoom}px`;
      if (node.id === walkId) {
        el.dataset.walkCurrent = "";
      } else {
        el.removeAttribute("data-walk-current");
      }
    }
    for (const [id, el] of nodeEls) {
      if (!seen.has(id)) {
        el.remove();
        nodeEls.delete(id);
      }
    }

    const walkNode =
      walkId !== null
        ? (graph.nodes.find((node) => node.id === walkId) ?? null)
        : null;
    if (walkNode) {
      if (!walkPanel) {
        walkPanel = document.createElement("div");
        walkPanel.className = "ew-graph__walk";
        root.appendChild(walkPanel);
      }
      walkPanel.replaceChildren();
      const head = document.createElement("div");
      head.className = "ew-graph__walk-head";
      const title = document.createElement("strong");
      title.textContent = walkNode.title;
      const endButton = document.createElement("button");
      endButton.type = "button";
      endButton.textContent = "End walk";
      endButton.addEventListener("click", () => {
        walkId = null;
        renderGraph();
      });
      head.append(title, endButton);
      walkPanel.appendChild(head);

      const walkEdges = graph.edges.filter((edge) => edge.from === walkId);
      if (walkEdges.length === 0) {
        const deadEnd = document.createElement("p");
        deadEnd.className = "ew-graph__walk-end";
        deadEnd.textContent = "Dead end.";
        walkPanel.appendChild(deadEnd);
      } else {
        for (const edge of walkEdges) {
          const choice = document.createElement("button");
          choice.type = "button";
          choice.className = "ew-graph__walk-choice";
          choice.append(`${edge.label ?? "→"} `);
          const target = document.createElement("span");
          target.className = "ew-graph__walk-target";
          target.textContent =
            graph.nodes.find((node) => node.id === edge.to)?.title ?? edge.to;
          choice.appendChild(target);
          choice.addEventListener("click", () => {
            walkId = edge.to;
            renderGraph();
          });
          walkPanel.appendChild(choice);
        }
      }
    } else if (walkPanel) {
      walkPanel.remove();
      walkPanel = null;
    }
  };

  const onAddNode = async () => {
    if (!graph) return;
    const position = nextNodePosition(graph);
    const id = newId("nod");
    const title = `Node ${graph.nodes.length + 1}`;
    const file = `manuscript/${title.toLowerCase().replace(/\s+/g, "-")}.md`;
    await ctx.eden.fs.mkdir("manuscript");
    await ctx.eden.fs.writeFile(
      file,
      serializeNodeFile({ id, title, status: "draft" }),
    );
    await persist(
      addNode(graph, { id, title, file, x: position.x, y: position.y }),
    );
    // Pan the new node into view (the rail is narrow).
    pan = {
      x: canvas.clientWidth / 2 - (position.x + NODE_WIDTH / 2) * zoom,
      y: canvas.clientHeight / 2 - (position.y + NODE_HEIGHT / 2) * zoom,
    };
    if (disposed) return;
    renderGraph();
    ctx.workspace.openFile(file);
  };

  const onNodePointerDown = (event, nodeId) => {
    event.stopPropagation();
    const node = graph?.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    event.target.setPointerCapture(event.pointerId);
    drag = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false,
    };
  };

  addButton.addEventListener("click", () => void onAddNode());

  walkButton.addEventListener("click", () => {
    if (!graph) return;
    walkId = walkId === null ? (graph.nodes[0]?.id ?? null) : null;
    renderGraph();
  });

  canvas.addEventListener("pointerdown", (event) => {
    // Background only — node buttons stopPropagation above.
    event.target.setPointerCapture(event.pointerId);
    panDrag = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (drag && graph) {
      const dx = (event.clientX - drag.startX) / zoom;
      const dy = (event.clientY - drag.startY) / zoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      graph = moveNode(
        graph,
        drag.nodeId,
        drag.originX + dx,
        drag.originY + dy,
      );
      renderGraph();
    } else if (panDrag) {
      pan = {
        x: panDrag.panX + (event.clientX - panDrag.startX),
        y: panDrag.panY + (event.clientY - panDrag.startY),
      };
      renderGraph();
    }
  });

  canvas.addEventListener("pointerup", async () => {
    if (drag) {
      const { nodeId, moved } = drag;
      drag = null;
      if (moved) {
        if (graph) await persist(graph);
      } else {
        const node = graph?.nodes.find((item) => item.id === nodeId);
        if (node) ctx.workspace.openFile(node.file);
      }
    }
    panDrag = null;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      // The rail must not scroll away while the reader zooms the canvas.
      event.preventDefault();
      zoom = Math.min(2, Math.max(0.4, zoom - Math.sign(event.deltaY) * 0.1));
      renderGraph();
    },
    { passive: false },
  );

  const load = async () => {
    await ensureGraph(ctx);
    if (disposed) return;
    const text = await ctx.eden.fs.readFile(GRAPH_PATH);
    if (disposed) return;
    try {
      graph = parseGraph(JSON.parse(text));
    } catch {
      graph = createEmptyGraph();
    }
    renderGraph();
  };
  void load();

  return () => {
    disposed = true;
  };
}

/* ===========================================================================
 * Registration: the canvas view and its ribbon item — nothing else.
 * ======================================================================== */

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    ctx.workspace.registerView({
      id: "story-canvas",
      title: "Story canvas",
      icon: "Waypoints",
      render: (element) => renderGraphView(ctx, element),
    });
    ctx.workspace.registerRibbonItem({
      id: "story-canvas-ribbon",
      icon: "Waypoints",
      title: "Story canvas",
      location: "sidebar-top",
      onClick: () => ctx.workspace.openView("story-canvas"),
    });
  },
});
