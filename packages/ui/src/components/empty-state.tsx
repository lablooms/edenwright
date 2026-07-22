import type { ReactNode } from "react";

import { Button } from "./button.js";
import "./empty-state.css";

export interface EmptyStateProps {
  /** Visual anchor — usually BloomIcon or a large Lucide icon. */
  icon: ReactNode;
  title: string;
  /** One warm sentence (§11). */
  body: string;
  /** Primary action label; disabled actions explain themselves via `hint`. */
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  /** Small dim line under the action, e.g. "Arrives in M1". */
  hint?: string;
}

/** The designed empty state (§11): icon + one warm sentence + one action. */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionDisabled,
  onAction,
  hint,
}: EmptyStateProps) {
  return (
    <div className="ew-empty-state">
      <div className="ew-empty-state__icon">{icon}</div>
      <h1 className="ew-empty-state__title">{title}</h1>
      <p className="ew-empty-state__body">{body}</p>
      {actionLabel ? (
        <Button disabled={actionDisabled} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {hint ? <p className="ew-empty-state__hint">{hint}</p> : null}
    </div>
  );
}
