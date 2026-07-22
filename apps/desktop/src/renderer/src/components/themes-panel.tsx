import { useEffect } from "react";
import { Check, Flower2, Trash2 } from "lucide-react";

import { useThemeStore } from "../themes/theme-store";
import { CommunitySection } from "./community-section";

import "./themes-panel.css";

/**
 * Themes panel (SPEC §9.5): installed themes with apply/remove, and the
 * community section (added with the registry slice). The built-in default
 * is always present and never uninstallable.
 */
export function ThemesPanel() {
  const { installed, active, refresh, apply, remove } = useThemeStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="ew-themes">
      <div className="ew-themes__header">
        <Flower2 size={16} aria-hidden />
        <h2>Themes</h2>
      </div>
      <p className="ew-themes__blurb">
        A theme is a pack of CSS variables — the whole garden, repainted.
      </p>
      <ul className="ew-themes__list">
        {installed.map((theme) => {
          const isActive = theme.manifest.id === active;
          return (
            <li
              key={theme.manifest.id}
              className={`ew-themes__card${isActive ? " ew-themes__card--active" : ""}`}
            >
              <div className="ew-themes__card-top">
                <span className="ew-themes__name">{theme.manifest.name}</span>
                <span className="ew-themes__version">
                  v{theme.manifest.version}
                </span>
              </div>
              {theme.manifest.description ? (
                <p className="ew-themes__description">
                  {theme.manifest.description}
                </p>
              ) : null}
              <div className="ew-themes__meta">
                <span className="ew-themes__author">
                  {theme.manifest.author ?? "Unknown author"}
                  {theme.builtin ? " · always installed" : ""}
                </span>
                <span className="ew-themes__actions">
                  {isActive ? (
                    <span className="ew-themes__active-badge">
                      <Check size={13} aria-hidden /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="ew-themes__apply"
                      onClick={() => void apply(theme.manifest.id)}
                    >
                      Apply
                    </button>
                  )}
                  {!theme.builtin && !isActive ? (
                    <button
                      type="button"
                      className="ew-themes__remove"
                      title={`Remove ${theme.manifest.name}`}
                      onClick={() => void remove(theme.manifest.id)}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <CommunitySection kind="themes" />
    </div>
  );
}
