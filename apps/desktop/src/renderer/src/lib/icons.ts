import {
  BarChart3,
  BookOpen,
  Clapperboard,
  Flag,
  Flower2,
  Gem,
  Leaf,
  MapPin,
  PanelsTopLeft,
  Puzzle,
  Rocket,
  Scroll,
  Sparkles,
  Sprout,
  Star,
  Timer,
  User,
  Waypoints,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Plugin-facing icon names (ribbon items, views) → Lucide components.
 * Small curated set, uniformly sized elsewhere (§3.3); unknown names fall
 * back to Puzzle, the plugin glyph.
 */
const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  Clapperboard,
  Flag,
  Flower2,
  Gem,
  Leaf,
  MapPin,
  PanelsTopLeft,
  Puzzle,
  Rocket,
  Scroll,
  Sparkles,
  Sprout,
  Star,
  Timer,
  User,
  Waypoints,
  Zap,
};

export function lucideByName(name: string | undefined): LucideIcon {
  if (!name) return Puzzle;
  return ICONS[name] ?? Puzzle;
}
