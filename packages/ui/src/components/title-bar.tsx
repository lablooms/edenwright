import { Minus, PanelRight, Square, X } from "lucide-react";

import { BloomIcon } from "./bloom-icon.js";
import { Icon } from "./icon.js";
import "./title-bar.css";

export interface TitleBarProps {
  /** macOS keeps native traffic lights instead of drawn window controls. */
  isMac: boolean;
  isMaximized: boolean;
  isPanelOpen: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  onTogglePanel: () => void;
  /** App-level menu (Help/About), rendered before the window controls. */
  menu?: React.ReactNode;
  /** Eden switcher (current eden name), rendered next to the brand. */
  switcher?: React.ReactNode;
  /** The beta badge opens About when provided. */
  onBadgeClick?: () => void;
}

/** Frameless window chrome: brand left, drag region center, controls right. */
export function TitleBar({
  isMac,
  isMaximized,
  isPanelOpen,
  onMinimize,
  onToggleMaximize,
  onClose,
  onTogglePanel,
  menu,
  switcher,
  onBadgeClick,
}: TitleBarProps) {
  return (
    <header className="ew-titlebar">
      <div
        className="ew-titlebar__brand"
        data-platform={isMac ? "mac" : "other"}
      >
        <BloomIcon size={18} halo={false} />
        <span className="ew-titlebar__wordmark">Edenwright</span>
        {onBadgeClick ? (
          <button
            type="button"
            className="ew-titlebar__badge ew-titlebar__badge--button"
            title="About Edenwright"
            onClick={onBadgeClick}
          >
            beta
          </button>
        ) : (
          <span className="ew-titlebar__badge">beta</span>
        )}
        {switcher}
      </div>
      <div className="ew-titlebar__drag" aria-hidden />
      <div className="ew-titlebar__actions">
        {menu}
        <button
          type="button"
          className="ew-titlebar__button"
          title={isPanelOpen ? "Hide panel" : "Show panel"}
          aria-pressed={isPanelOpen}
          onClick={onTogglePanel}
        >
          <Icon icon={PanelRight} size={16} />
        </button>
        {isMac ? null : (
          <>
            <button
              type="button"
              className="ew-titlebar__button"
              title="Minimize"
              onClick={onMinimize}
            >
              <Icon icon={Minus} size={16} />
            </button>
            <button
              type="button"
              className="ew-titlebar__button"
              title={isMaximized ? "Restore" : "Maximize"}
              onClick={onToggleMaximize}
            >
              <Icon icon={Square} size={14} />
            </button>
            <button
              type="button"
              className="ew-titlebar__button ew-titlebar__button--close"
              title="Close"
              onClick={onClose}
            >
              <Icon icon={X} size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
