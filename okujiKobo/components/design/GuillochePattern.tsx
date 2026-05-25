'use client'

interface Props {
  /** 10–100 (maps to opacity). Matches background_opacity on DesignerPassportPage. */
  opacity?: number
  /** Stroke color. Defaults to black. */
  color?: string
  /** Unique id prefix for SVG defs (to avoid conflicts when multiple pages shown). */
  patternId?: string
}

/**
 * Fills the parent element with a tiled 32×32pt guilloche pattern.
 * Composed of two nested ellipses (0° and 45°) plus a diamond outline.
 */
export function GuillochePattern({
  opacity = 12,
  color = '#000000',
  patternId = 'guilloche',
}: Props) {
  const clampedOpacity = Math.max(10, Math.min(100, opacity)) / 100
  const id = `${patternId}-tile`

  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={id} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          {/* Outer ellipse — horizontal */}
          <ellipse cx="16" cy="16" rx="14" ry="7" fill="none" stroke={color} strokeWidth="0.6" />
          {/* Inner ellipse — rotated 45° (guilloche cross) */}
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="7"
            fill="none"
            stroke={color}
            strokeWidth="0.6"
            transform="rotate(45 16 16)"
          />
          {/* Diamond outline */}
          <path
            d="M16,2 L30,16 L16,30 L2,16 Z"
            fill="none"
            stroke={color}
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={clampedOpacity} />
    </svg>
  )
}
