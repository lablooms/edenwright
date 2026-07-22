/**
 * The Lablooms ink-drop bloom in Edenwright leaf tones (SPEC §3.3).
 * Inline SVG so components stay token-driven (no hardcoded hex, §3.1 rule);
 * the standalone asset at src/assets/bloom-icon.svg mirrors this geometry
 * for the packaged app icon.
 */

export interface BloomIconProps {
  /** Rendered width/height in px. */
  size?: number;
  /** Whether to paint the void-colored rounded-square halo. */
  halo?: boolean;
}

const OUTER_PETALS = [0, 45, 90, 135, 180, 225, 270, 315];
const INNER_PETALS = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

export function BloomIcon({ size = 24, halo = true }: BloomIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Edenwright bloom"
    >
      {halo ? (
        <rect width="1024" height="1024" rx="224" fill="var(--ew-void)" />
      ) : null}
      <g fill="var(--ew-leaf-bright)">
        {OUTER_PETALS.map((angle) => (
          <ellipse
            key={angle}
            cx="512"
            cy="290"
            rx="100"
            ry="200"
            transform={angle === 0 ? undefined : `rotate(${angle} 512 512)`}
          />
        ))}
      </g>
      <g fill="var(--ew-leaf)">
        {INNER_PETALS.map((angle) => (
          <ellipse
            key={angle}
            cx="512"
            cy="350"
            rx="64"
            ry="140"
            transform={`rotate(${angle} 512 512)`}
          />
        ))}
      </g>
      <circle cx="512" cy="512" r="76" fill="var(--ew-leaf-deep)" />
    </svg>
  );
}
