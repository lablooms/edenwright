import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CorkboardRow,
  EdenManifestInfo,
  TimelineRow,
} from "../../../preload/api";
import { ipcErrorMessage, useAppStore } from "../store";
import "./goals-section.css";

interface Stats {
  total: number;
  today: number;
  series: { day: string; words: number }[];
}

function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const fraction = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ew-progress" title={label}>
      <div
        className="ew-progress__bar"
        style={{ width: `${fraction * 100}%` }}
      />
      <span className="ew-progress__label">{label}</span>
    </div>
  );
}

/** Goals & streaks (§7.8): targets, today's pace, streak, per-day chart. */
export function GoalsSection({ manifest }: { manifest: EdenManifestInfo }) {
  const toast = useAppStore((state) => state.toast);
  const refreshManifest = useAppStore((state) => state.refreshManifest);
  const openFile = useAppStore((state) => state.openFile);

  const [stats, setStats] = useState<Stats | null>(null);
  // One eden = one story: goals count every word in the eden (".").
  const load = useCallback(() => {
    void window.edenwright.query.stats(".", 35).then(setStats);
  }, []);
  useEffect(load, [load, openFile?.mtimeMs]);

  const streak = useMemo(() => {
    if (!stats) return 0;
    let count = 0;
    for (let i = stats.series.length - 1; i >= 0; i -= 1) {
      if (stats.series[i].words > 0) count += 1;
      else if (i < stats.series.length - 1) break;
    }
    return count;
  }, [stats]);

  const maxDay = useMemo(
    () => Math.max(1, ...(stats?.series.map((row) => row.words) ?? [1])),
    [stats],
  );

  const saveGoals = async (patch: {
    targetWords?: number;
    dailyWords?: number;
  }) => {
    try {
      await window.edenwright.eden.saveManifest({
        ...manifest,
        goals: { ...manifest.goals, ...patch },
      });
      await refreshManifest();
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
    }
  };

  const target = manifest.goals.targetWords ?? 0;
  const daily = manifest.goals.dailyWords ?? 0;

  return (
    <section className="ew-goals">
      <h3 className="details-panel__heading">Goals</h3>

      <div className="ew-goals__editors">
        <label className="ew-goals__field">
          <span>Target</span>
          <input
            type="number"
            min={0}
            placeholder="90000"
            value={target || ""}
            onChange={(event) =>
              void saveGoals({ targetWords: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label className="ew-goals__field">
          <span>Daily</span>
          <input
            type="number"
            min={0}
            placeholder="500"
            value={daily || ""}
            onChange={(event) =>
              void saveGoals({ dailyWords: Number(event.target.value) || 0 })
            }
          />
        </label>
      </div>

      {target > 0 ? (
        <ProgressBar
          value={stats?.total ?? 0}
          max={target}
          label={`${(stats?.total ?? 0).toLocaleString()} / ${target.toLocaleString()} words`}
        />
      ) : null}
      {daily > 0 ? (
        <ProgressBar
          value={stats?.today ?? 0}
          max={daily}
          label={`today ${(stats?.today ?? 0).toLocaleString()} / ${daily.toLocaleString()}`}
        />
      ) : null}

      <div className="ew-goals__streak">
        <span className="ew-goals__streak-count">{streak}</span>
        <span className="ew-goals__streak-label">
          day{streak === 1 ? "" : "s"} writing
        </span>
        <div className="ew-goals__calendar">
          {stats?.series.map((row) => (
            <span
              key={row.day}
              className="ew-goals__day"
              data-words={row.words > 0 || undefined}
              title={`${row.day}: ${row.words.toLocaleString()} words`}
            />
          ))}
        </div>
      </div>

      <div className="ew-goals__chart">
        {stats?.series.slice(-14).map((row) => (
          <div
            key={row.day}
            className="ew-goals__bar"
            style={{ height: `${Math.max(4, (row.words / maxDay) * 48)}px` }}
            title={`${row.day}: ${row.words.toLocaleString()}`}
          />
        ))}
      </div>
    </section>
  );
}

/** Serial schedule view (§7.8): planned (storyDate) vs. published (status). */
export function ScheduleSection({ manifest }: { manifest: EdenManifestInfo }) {
  const openFileAt = useAppStore((state) => state.openFileAt);
  const [chapters, setChapters] = useState<
    {
      path: string;
      title: string;
      storyDate: string | null;
      status: string | null;
    }[]
  >([]);

  useEffect(() => {
    void Promise.all([
      window.edenwright.query.corkboard(),
      window.edenwright.query.timeline(),
    ]).then(([cards, dated]) => {
      const dates = new Map(
        dated.map((row: TimelineRow) => [row.path, row.storyDate]),
      );
      setChapters(
        cards
          .map((card: CorkboardRow) => ({
            path: card.path,
            title: card.title,
            storyDate: dates.get(card.path) ?? null,
            status: card.status,
          }))
          .sort((a, b) =>
            (a.storyDate ?? "9999").localeCompare(b.storyDate ?? "9999"),
          ),
      );
    });
  }, [manifest.id]);

  if (chapters.length === 0) return null;

  return (
    <section className="ew-goals">
      <h3 className="details-panel__heading">Schedule</h3>
      <ul className="ew-schedule">
        {chapters.map((chapter) => (
          <li key={chapter.path}>
            <button
              type="button"
              className="ew-schedule__row"
              onClick={() => void openFileAt(chapter.path)}
            >
              <span className="ew-schedule__title">{chapter.title}</span>
              <span className="ew-schedule__date">
                {chapter.storyDate ?? "unplanned"}
              </span>
              <span
                className="ew-schedule__status"
                data-published={chapter.status === "final" || undefined}
              >
                {chapter.status ?? "draft"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
