import type { LucideIcon } from "lucide-react";

import { Icon } from "./icon.js";
import "./sidebar.css";

export interface SidebarItem {
  id: string;
  icon: LucideIcon;
  /** Tooltip + accessible label — plain English (vocabulary law, §3.4). */
  title: string;
  /** Placeholder surfaces ship disabled with a "coming soon" title. */
  disabled?: boolean;
}

export interface SidebarProps {
  topItems: SidebarItem[];
  bottomItems: SidebarItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
}

/** The left activity bar. Top section navigates, bottom section configures. */
export function Sidebar({
  topItems,
  bottomItems,
  activeId,
  onSelect,
}: SidebarProps) {
  const renderItem = (item: SidebarItem) => {
    const isActive = item.id === activeId;
    return (
      <button
        key={item.id}
        type="button"
        className="ew-sidebar__item"
        title={item.title}
        aria-label={item.title}
        aria-pressed={isActive}
        disabled={item.disabled}
        data-active={isActive || undefined}
        onClick={() => onSelect(item.id)}
      >
        <Icon icon={item.icon} size={20} />
      </button>
    );
  };

  return (
    <nav className="ew-sidebar" aria-label="Primary">
      <div className="ew-sidebar__section">{topItems.map(renderItem)}</div>
      <div className="ew-sidebar__section ew-sidebar__section--bottom">
        {bottomItems.map(renderItem)}
      </div>
    </nav>
  );
}
