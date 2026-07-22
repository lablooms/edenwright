import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  findTimelineCollisions,
  ordinalToStoryDate,
  parseMarkdown,
  serializeMarkdown,
  storyDateToOrdinal,
} from "@edenwright/core";
import { CalendarClock, TriangleAlert } from "lucide-react";

import { EmptyState, Icon } from "@edenwright/ui";

import type { TimelineRow } from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";
import "./timeline-view.css";

interface PlottedScene extends TimelineRow {
  ordinal: number;
  narrativeIndex: number;
}

/** The timeline (§7.6): story dates as a track, narrative order as a second. */
export function TimelineView() {
  const openFileAt = useAppStore((state) => state.openFileAt);
  const toast = useAppStore((state) => state.toast);

  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [filter, setFilter] = useState("");
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    void window.edenwright.query.timeline().then(setRows);
  }, []);
  useEffect(load, [load]);

  const scenes = useMemo<PlottedScene[]>(() => {
    const dated = rows
      .map((row) => ({ ...row, ordinal: storyDateToOrdinal(row.storyDate) }))
      .filter(
        (row): row is TimelineRow & { ordinal: number } => row.ordinal !== null,
      );
    const narrative = [...dated].sort((a, b) =>
      `${a.container}/${a.path}`.localeCompare(`${b.container}/${b.path}`),
    );
    const indexOf = new Map(narrative.map((row, index) => [row.path, index]));
    return dated
      .map((row) => ({ ...row, narrativeIndex: indexOf.get(row.path) ?? 0 }))
      .filter((row) => !filter || row.container === filter);
  }, [rows, filter]);

  const [minOrdinal, maxOrdinal] = useMemo(() => {
    if (scenes.length === 0) return [0, 0];
    const ordinals = scenes.map((scene) => scene.ordinal);
    return [Math.min(...ordinals), Math.max(...ordinals)];
  }, [scenes]);

  const collisions = useMemo(
    () =>
      findTimelineCollisions(
        scenes.map((scene) => ({ path: scene.path, ordinal: scene.ordinal })),
        new Map(scenes.map((scene) => [scene.path, scene.mentions])),
      ),
    [scenes],
  );
  const flaggedPaths = useMemo(
    () => new Set(collisions.flatMap((collision) => collision.paths)),
    [collisions],
  );

  const span = Math.max(1, maxOrdinal - minOrdinal);
  const xFor = (ordinal: number, width: number) =>
    ((ordinal - minOrdinal) / span) * (width - 24) + 12;

  const onMarkerDown = useCallback(
    (event: React.PointerEvent, scene: PlottedScene) => {
      event.preventDefault();
      const track = trackRef.current;
      if (!track) return;
      setDragPath(scene.path);
      setDragX(
        ((scene.ordinal - minOrdinal) / span) * (track.clientWidth - 24) + 12,
      );
      const onMove = (move: PointerEvent) => {
        const rect = track.getBoundingClientRect();
        setDragX(
          Math.min(rect.width - 12, Math.max(12, move.clientX - rect.left)),
        );
      };
      const onUp = async (up: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setDragPath(null);
        const rect = track.getBoundingClientRect();
        const fraction =
          (Math.min(rect.width - 12, Math.max(12, up.clientX - rect.left)) -
            12) /
          (rect.width - 24);
        const ordinal = Math.round(minOrdinal + fraction * span);
        const storyDate = ordinalToStoryDate(ordinal);
        if (storyDate !== scene.storyDate) {
          try {
            const file = await window.edenwright.files.read(scene.path);
            const parsed = parseMarkdown(file.content);
            const next = serializeMarkdown(
              { ...parsed.data, storyDate },
              parsed.body,
            );
            await window.edenwright.files.write(scene.path, next, file.mtimeMs);
            toast(`storyDate → ${storyDate}`);
            load();
          } catch (error) {
            toast(ipcErrorMessage(error), "warn");
          }
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [load, minOrdinal, span, toast],
  );

  const containers = useMemo(
    () => [...new Set(scenes.map((scene) => scene.container))].sort(),
    [scenes],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={CalendarClock} size={40} strokeWidth={1.2} />}
        title="Nothing on the timeline yet."
        body="Add a storyDate to a scene's frontmatter and it plots here — with narrative order beside it and gentle continuity flags."
        hint="storyDate: 1042-03-17 in any scene file"
      />
    );
  }

  return (
    <div className="timeline">
      <div className="timeline__toolbar">
        <button
          type="button"
          className="timeline__chip"
          title="Back to the editor"
          onClick={() => useAppStore.getState().setMainView("editor")}
        >
          ← Editor
        </button>
        <button
          type="button"
          className="timeline__chip"
          data-active={filter === "" || undefined}
          onClick={() => setFilter("")}
        >
          All
        </button>
        {containers.map((container) => (
          <button
            key={container}
            type="button"
            className="timeline__chip"
            data-active={filter === container || undefined}
            onClick={() => setFilter(container)}
            title={container}
          >
            {container.split("/")[1] ?? container}
          </button>
        ))}
        {collisions.length > 0 ? (
          <span
            className="timeline__warning"
            title={collisions
              .map(
                (collision) =>
                  `@${collision.entityKey}: ${collision.paths.join(" + ")}`,
              )
              .join("\n")}
          >
            <Icon icon={TriangleAlert} size={13} /> {collisions.length}{" "}
            {collisions.length === 1 ? "flag" : "flags"}
          </span>
        ) : null}
      </div>

      <div className="timeline__tracks">
        <div className="timeline__track-label">Story date</div>
        <div className="timeline__track" ref={trackRef}>
          {scenes.map((scene) => {
            const track = trackRef.current;
            const x =
              dragPath === scene.path && track
                ? dragX
                : xFor(scene.ordinal, track?.clientWidth ?? 600);
            return (
              <button
                key={scene.path}
                type="button"
                className="timeline__marker"
                data-flagged={flaggedPaths.has(scene.path) || undefined}
                style={{ left: x }}
                title={`${scene.title} — ${scene.storyDate}\n${scene.path}`}
                onPointerDown={(event) => onMarkerDown(event, scene)}
                onClick={() => void openFileAt(scene.path)}
              >
                <span className="timeline__marker-dot" />
                <span className="timeline__marker-title">{scene.title}</span>
              </button>
            );
          })}
        </div>
        <div className="timeline__axis">
          <span>{ordinalToStoryDate(minOrdinal)}</span>
          <span>{ordinalToStoryDate(maxOrdinal)}</span>
        </div>

        <div className="timeline__track-label">Narrative order</div>
        <div className="timeline__track timeline__track--narrative">
          {scenes.map((scene) => {
            const width = trackRef.current?.clientWidth ?? 600;
            const x =
              (scene.narrativeIndex / Math.max(1, scenes.length - 1)) *
                (width - 24) +
              12;
            const dateX = xFor(scene.ordinal, width);
            const drift = Math.abs(x - dateX) > 20;
            return (
              <button
                key={scene.path}
                type="button"
                className="timeline__marker timeline__marker--narrative"
                data-drift={drift || undefined}
                style={{ left: x }}
                title={`${scene.title} — #${scene.narrativeIndex + 1} in narrative order`}
                onClick={() => void openFileAt(scene.path)}
              >
                <span className="timeline__marker-dot" />
                <span className="timeline__marker-title">{scene.title}</span>
              </button>
            );
          })}
        </div>
        <p className="timeline__hint">
          Drag markers on the date track to move storyDate. Amber flags: one
          entity, two places, same day — advisory, always.
        </p>
      </div>
    </div>
  );
}
