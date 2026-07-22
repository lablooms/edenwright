import type { LucideIcon } from "lucide-react";

export interface IconProps {
  icon: LucideIcon;
  /** Rendered size in px; keep uniform per surface (§3.3). */
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Thin uniform wrapper so every in-app icon is Lucide, sized consistently. */
export function Icon({
  icon: LucideIconComponent,
  size = 18,
  strokeWidth = 1.8,
  className,
}: IconProps) {
  return (
    <LucideIconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
    />
  );
}
