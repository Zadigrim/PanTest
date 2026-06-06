/**
 * Tiny 12-week acquisitions sparkline. Inline SVG, no chart lib,
 * no axes, no labels — the line shape is the message.
 *
 * Gate: the renderer expects at least one non-zero bucket. With
 * zero data the component returns null so the caller can fall
 * back to a "since {date}" label. Per spec: sparse data renders
 * as text, never a misleading flat line.
 */

interface Props {
  values: number[]
  width?: number
  height?: number
}

export function Sparkline({ values, width = 240, height = 36 }: Props) {
  const max = Math.max(...values, 1)
  // Min set to 0 — acquisitions never go negative; baseline starts
  // at the bottom so a single-bucket spike reads correctly.
  const n = values.length
  if (n === 0) return null
  if (values.every((v) => v === 0)) return null

  const stepX = width / Math.max(1, n - 1)
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - (v / max) * (height - 4) - 2  // 2px top + bottom padding
    return [x, y] as const
  })

  // Smooth-ish line via straight segments — chart libs would
  // bezier-smooth this, but at 240×36 the eye can't tell.
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(' ')

  // Soft area fill underneath for the "trend" feel.
  const areaPath =
    `M 0 ${height} ` +
    points.map(([x, y]) => `L ${x} ${y}`).join(' ') +
    ` L ${width} ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Acquisitions trend, last ${n} weeks`}
    >
      <path d={areaPath} fill="currentColor" opacity={0.12} />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Last-bucket dot — emphasizes "this week". */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.25}
        fill="currentColor"
      />
    </svg>
  )
}
