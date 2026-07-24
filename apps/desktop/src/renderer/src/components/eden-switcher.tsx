import { Icon } from "@edenwright/ui";
import { ChevronDown } from "lucide-react";

import { useAppStore } from "../store";
import "./eden-switcher.css";

/**
 * The one canonical eden name in the chrome (SPEC §3 home): click it to
 * close the eden and land back on the launcher.
 */
export function EdenSwitcher() {
  const name = useAppStore((state) => state.edenState?.current?.info.name);
  const closeEden = useAppStore((state) => state.closeEden);

  if (!name) return null;

  return (
    <button
      type="button"
      className="eden-switcher"
      title="Switch eden"
      onClick={() => void closeEden()}
    >
      <span className="eden-switcher__name">{name}</span>
      <Icon icon={ChevronDown} size={14} />
    </button>
  );
}
