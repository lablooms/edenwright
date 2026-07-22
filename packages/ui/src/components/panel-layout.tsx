import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import "./panel-layout.css";

export interface PanelLayoutProps {
  /** The activity bar (Sidebar), always visible. */
  activityBar: ReactNode;
  /** Left panel (e.g. the file tree); fixed width, always visible when set. */
  sidePanel?: ReactNode;
  sidePanelWidth?: number;
  /** Main content area. */
  children: ReactNode;
  /** Right-hand panel content; rendered when `panelOpen`. */
  panel?: ReactNode;
  panelOpen: boolean;
  panelWidth: number;
  /** Minimum panel width in px (resizer clamps). */
  minPanelWidth?: number;
  /** Maximum panel width in px (resizer clamps). */
  maxPanelWidth?: number;
  onPanelResize: (width: number) => void;
}

/** App grid: activity bar · optional left panel · main · optional resizable right panel. */
export function PanelLayout({
  activityBar,
  sidePanel,
  sidePanelWidth = 260,
  children,
  panel,
  panelOpen,
  panelWidth,
  minPanelWidth = 200,
  maxPanelWidth = 480,
  onPanelResize,
}: PanelLayoutProps) {
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = panelWidth;

    const onMove = (move: globalThis.PointerEvent) => {
      // Panel sits on the right: dragging left widens it.
      const delta = startX - move.clientX;
      const next = Math.min(
        maxPanelWidth,
        Math.max(minPanelWidth, startWidth + delta),
      );
      onPanelResize(next);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  return (
    <div className="ew-panel-layout">
      {activityBar}
      {sidePanel ? (
        <aside
          className="ew-panel-layout__side"
          style={{ width: sidePanelWidth }}
        >
          {sidePanel}
        </aside>
      ) : null}
      <main className="ew-panel-layout__main">{children}</main>
      {panelOpen && panel ? (
        <>
          <div
            className="ew-panel-layout__resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            onPointerDown={startResize}
          />
          <aside
            className="ew-panel-layout__panel"
            style={{ width: panelWidth }}
          >
            {panel}
          </aside>
        </>
      ) : null}
    </div>
  );
}
