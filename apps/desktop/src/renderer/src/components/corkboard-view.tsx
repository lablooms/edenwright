import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LayoutGrid } from "lucide-react";

import { EmptyState, Icon } from "@edenwright/ui";

import type { CorkboardRow } from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";
import "./corkboard-view.css";

/** Status → token-styled class (no new colors, §3.1). */
function statusClass(status: string | null): string {
  const value = (status ?? "").toLowerCase();
  if (value === "final" || value === "done" || value === "complete") {
    return "ew-status--final";
  }
  if (value === "revised" || value === "rewrite" || value === "edit") {
    return "ew-status--revised";
  }
  if (value === "draft" || value === "") return "ew-status--draft";
  return "ew-status--other";
}

/** The corkboard (§7.7): the eden's files as index cards, draggable. */
export function CorkboardView() {
  const openFileAt = useAppStore((state) => state.openFileAt);
  const toast = useAppStore((state) => state.toast);
  const edenManifest = useAppStore((state) => state.edenManifest);
  const refreshManifest = useAppStore((state) => state.refreshManifest);

  const [rows, setRows] = useState<CorkboardRow[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const dragRef = useRef<{ path: string; startX: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cards, manifest] = await Promise.all([
      window.edenwright.query.corkboard(),
      window.edenwright.eden.manifest(),
    ]);
    setRows(cards);
    setOrder(manifest.order);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    const rank = new Map(order.map((path, index) => [path, index]));
    return [...rows].sort((a, b) => {
      const ra = rank.get(a.path) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.path) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.path.localeCompare(b.path);
    });
  }, [rows, order]);

  const onCardDown = useCallback(
    (event: React.PointerEvent, path: string) => {
      event.preventDefault();
      dragRef.current = { path, startX: event.clientX };
      // Drop target tracked locally — a state read inside the up-handler
      // would be the stale closure value (always null).
      let over: string | null = null;
      const onMove = (move: PointerEvent) => {
        const element = document.elementFromPoint(move.clientX, move.clientY);
        const card = element?.closest("[data-card-path]");
        over = card?.getAttribute("data-card-path") ?? null;
        setDragOver(over);
      };
      const onUp = async () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const drag = dragRef.current;
        dragRef.current = null;
        setDragOver(null);
        if (!drag || !over || over === drag.path) return;

        // Owner resolved through the bridge — the store's manifest may
        // still be catching up on a cold start.
        const manifest =
          edenManifest ?? (await window.edenwright.eden.manifest());

        const paths = cards.map((card) => card.path);
        const from = paths.indexOf(drag.path);
        const to = paths.indexOf(over);
        if (from === -1 || to === -1) return;
        paths.splice(to, 0, ...paths.splice(from, 1));
        try {
          await window.edenwright.eden.saveManifest({
            ...manifest,
            order: paths,
          });
          setOrder(paths);
          await refreshManifest();
          toast("Order saved to eden.json.");
        } catch (error) {
          toast(ipcErrorMessage(error), "warn");
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [cards, edenManifest, refreshManifest, toast],
  );

  return (
    <div className="corkboard">
      <div className="corkboard__toolbar">
        <button
          type="button"
          className="corkboard__chip"
          title="Back to the editor"
          onClick={() => useAppStore.getState().setMainView("editor")}
        >
          ← Editor
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<Icon icon={LayoutGrid} size={40} strokeWidth={1.2} />}
          title="No cards on the board."
          body="Scenes with a synopsis and a status become index cards here — drag them into the order your story wants."
          hint="synopsis and status live in each scene's frontmatter"
        />
      ) : (
        <div className="corkboard__grid">
          {cards.map((card) => (
            <button
              key={card.path}
              type="button"
              data-card-path={card.path}
              className="corkboard__card"
              data-drag-over={dragOver === card.path || undefined}
              title={card.path}
              onPointerDown={(event) => onCardDown(event, card.path)}
              onClick={() => void openFileAt(card.path)}
            >
              <header className="corkboard__card-head">
                <span className="corkboard__card-title">{card.title}</span>
                <span
                  className={`corkboard__card-status ${statusClass(card.status)}`}
                >
                  {card.status ?? "unset"}
                </span>
              </header>
              <p className="corkboard__card-synopsis">
                {card.synopsis || (
                  <span className="corkboard__card-empty">No synopsis yet</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
