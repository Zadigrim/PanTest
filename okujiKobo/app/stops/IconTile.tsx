'use client'

import { iconComponentForClassifiers } from '@/lib/design/stop-library/classifier-icons'

/**
 * Small line-icon tile reused on cards + drawer header.
 *
 * Picks a lucide component based on the stop's primary
 * classifier and renders it inside a rounded rail-bg tile.
 * Stroke uses currentColor so consumers can flip the ink (e.g.
 * faded for ghost previews).
 */
export function IconTile({
  classifiers,
  size = 44,
}: {
  classifiers: string[]
  /** Side of the tile in px. */
  size?: number
}) {
  const Icon = iconComponentForClassifiers(classifiers)
  // Icon takes ~58% of tile so there's visible padding inside
  // the rounded square. Matches the cover-editor stop chip
  // proportion.
  const iconPx = Math.round(size * 0.58)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[8px] bg-surface-workspace text-ink"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon style={{ width: iconPx, height: iconPx }} strokeWidth={1.75} />
    </span>
  )
}
