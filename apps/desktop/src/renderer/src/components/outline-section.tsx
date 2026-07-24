import { useDeferredValue, useMemo } from "react";

import { EditorView } from "@codemirror/view";

import { useEditorViewStore } from "../editor/editor-view-store";
import { useAppStore } from "../store";
import "./outline-section.css";

interface OutlineHeading {
  level: number;
  text: string;
  /** 1-based line number — jumping maps it straight to a CM position. */
  line: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * The document outline (R4): headings of the open file, indented by depth;
 * a click scrolls the editor there. Line-based by design — a syntax-tree
 * walk would buy nothing a writer can see.
 */
export function OutlineSection() {
  const content = useAppStore((state) => state.openFile?.content ?? "");
  const view = useEditorViewStore((state) => state.view);
  // Typing defers re-parsing — the outline never steals keystroke time.
  const deferred = useDeferredValue(content);

  const headings = useMemo<OutlineHeading[]>(() => {
    const found: OutlineHeading[] = [];
    const lines = deferred.split("\n");
    // Frontmatter is not a heading farm — skip the block.
    let inFrontmatter = lines[0]?.trim() === "---";
    lines.forEach((text, index) => {
      if (inFrontmatter) {
        if (index > 0 && text.trim() === "---") inFrontmatter = false;
        return;
      }
      const match = HEADING_RE.exec(text);
      if (match) {
        found.push({
          level: match[1].length,
          text: match[2].replace(/\s*#+$/, ""),
          line: index + 1,
        });
      }
    });
    return found;
  }, [deferred]);

  const jump = (line: number) => {
    if (!view) return;
    const target = view.state.doc.line(Math.min(line, view.state.doc.lines));
    view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: "start" }),
    });
    view.focus();
  };

  return (
    <section className="outline-section" aria-label="Outline">
      <h3 className="outline-section__heading">Outline</h3>
      {headings.length === 0 ? (
        <p className="outline-section__empty">
          No headings yet — select text and press Ctrl+1 to make one.
        </p>
      ) : (
        <ul className="outline-section__list">
          {headings.map((heading) => (
            <li key={`${heading.line}:${heading.text}`}>
              <button
                type="button"
                className="outline-section__item"
                style={
                  {
                    "--ew-outline-depth": heading.level - 1,
                  } as React.CSSProperties
                }
                onClick={() => jump(heading.line)}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
