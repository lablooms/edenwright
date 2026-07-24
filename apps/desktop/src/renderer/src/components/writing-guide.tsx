import { useState } from "react";

import { ExternalLink } from "lucide-react";

import { Button, Icon } from "@edenwright/ui";

import { useChromeStore } from "../chrome-store";
import "./writing-guide.css";

const SHORTCUTS: { action: string; keys: string }[] = [
  { action: "Bold", keys: "Ctrl/Cmd+B" },
  { action: "Italic", keys: "Ctrl/Cmd+I" },
  { action: "Make a link", keys: "Ctrl/Cmd+K" },
  { action: "Big heading", keys: "Ctrl/Cmd+1" },
  { action: "Medium heading", keys: "Ctrl/Cmd+2" },
  { action: "Small heading", keys: "Ctrl/Cmd+3" },
  { action: "Save", keys: "Ctrl/Cmd+S" },
  { action: "Find in this file", keys: "Ctrl/Cmd+F" },
  { action: "Find anything (files & commands)", keys: "Ctrl/Cmd+P" },
  { action: "Search the whole eden", keys: "Ctrl/Cmd+Shift+F" },
  { action: "Focus mode", keys: "Ctrl/Cmd+Shift+Enter" },
];

const GUIDE_URL =
  "https://github.com/lablooms/edenwright/blob/main/docs/user-guide.md";

/**
 * The in-app writing guide (R4): a cheat-sheet and a plain-words answer to
 * "what are those little marks?" — for writers who have never heard of
 * markdown, so the word never appears here.
 */
export function WritingGuide() {
  const setGuideOpen = useChromeStore((state) => state.setGuideOpen);
  const [tab, setTab] = useState<"shortcuts" | "how">("shortcuts");

  return (
    <div
      className="guide-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setGuideOpen(false);
      }}
    >
      <div className="guide" role="dialog" aria-label="Writing guide">
        <nav className="guide__tabs">
          <button
            type="button"
            className="guide__tab"
            data-active={tab === "shortcuts" || undefined}
            onClick={() => setTab("shortcuts")}
          >
            Shortcuts
          </button>
          <button
            type="button"
            className="guide__tab"
            data-active={tab === "how" || undefined}
            onClick={() => setTab("how")}
          >
            How formatting works
          </button>
        </nav>

        <div className="guide__body">
          {tab === "shortcuts" ? (
            <table className="guide__table">
              <tbody>
                {SHORTCUTS.map((shortcut) => (
                  <tr key={shortcut.action}>
                    <td className="guide__action">{shortcut.action}</td>
                    <td className="guide__keys">{shortcut.keys}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="guide__prose">
              <p>
                Edenwright keeps your words in plain text files in your eden
                folder. They are yours forever — any app, now or in fifty years,
                can open them. Nothing is locked away in a database.
              </p>
              <p>
                When you make something bold or turn a line into a heading, the
                toolbar quietly writes a little code around the words for you —
                you never have to learn it. The buttons and the shortcuts do the
                same thing, so use whichever feels natural.
              </p>
              <p>
                If you ever do see the codes — say ** around a word — that's
                just bold wearing its work clothes. Your file still reads
                perfectly fine in any other app, codes and all.
              </p>
              <button
                type="button"
                className="guide__link"
                onClick={() =>
                  void window.edenwright.app.openExternal(GUIDE_URL)
                }
              >
                Want the full manual? <Icon icon={ExternalLink} size={12} />
              </button>
            </div>
          )}
        </div>

        <footer className="guide__footer">
          <Button onClick={() => setGuideOpen(false)}>Close</Button>
        </footer>
      </div>
    </div>
  );
}
