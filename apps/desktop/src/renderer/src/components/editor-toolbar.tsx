import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";

import { Icon } from "@edenwright/ui";

import { useEditorViewStore } from "../editor/editor-view-store";
import { formatCommands, type FormatId } from "../editor/format-commands";
import "./editor-toolbar.css";

interface ToolbarButton {
  id: FormatId;
  icon: typeof Bold;
  /** Action name plus its hotkey — writers learn the keys from here. */
  tooltip: string;
}

const BUTTONS: ToolbarButton[] = [
  { id: "bold", icon: Bold, tooltip: "Bold — Ctrl/Cmd+B" },
  { id: "italic", icon: Italic, tooltip: "Italic — Ctrl/Cmd+I" },
  { id: "strikethrough", icon: Strikethrough, tooltip: "Strikethrough" },
  { id: "h1", icon: Heading1, tooltip: "Big heading — Ctrl/Cmd+1" },
  { id: "h2", icon: Heading2, tooltip: "Medium heading — Ctrl/Cmd+2" },
  { id: "h3", icon: Heading3, tooltip: "Small heading — Ctrl/Cmd+3" },
  { id: "quote", icon: Quote, tooltip: "Quote" },
  { id: "bullet", icon: List, tooltip: "Bulleted list" },
  { id: "numbered", icon: ListOrdered, tooltip: "Numbered list" },
  { id: "link", icon: Link, tooltip: "Link — Ctrl/Cmd+K" },
];

/**
 * The writer toolbar (R4): formatting for people who have never heard of
 * markdown. It only ever runs the shared format commands on the live
 * editor — the codes stay in the file, out of the writer's way.
 *
 * Hidden in focus mode (the viewer gates that) and whenever a plugin editor
 * mode owns the editor: medium modes tag their editor DOM with the
 * `cm-ew-plugin-mode` class and CSS lifts the bar away (viewer.css).
 */
export function EditorToolbar({ disabled }: { disabled: boolean }) {
  const view = useEditorViewStore((state) => state.view);
  const activeFormats = useEditorViewStore((state) => state.activeFormats);

  const run = (id: FormatId) => {
    if (!view || disabled) return;
    formatCommands[id](view);
    // The bar must never steal the writer's caret.
    view.focus();
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
      {BUTTONS.map((button) => (
        <button
          key={button.id}
          type="button"
          className="editor-toolbar__button"
          title={button.tooltip}
          aria-label={button.tooltip}
          aria-pressed={activeFormats.has(button.id)}
          data-active={activeFormats.has(button.id) || undefined}
          disabled={disabled || !view}
          // mousedown would blur the editor and drop the selection.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run(button.id)}
        >
          <Icon icon={button.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
