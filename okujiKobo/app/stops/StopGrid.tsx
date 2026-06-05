'use client'

import { StopCard } from './StopCard'
import type { StopCardData } from './types'

export function StopGrid({
  stops,
  onOpen,
  focusedId,
}: {
  stops: StopCardData[]
  onOpen: (id: string) => void
  focusedId: string | null
}) {
  if (stops.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-hairline bg-white px-3 py-12 text-center">
        <p className="text-[13px] text-ink">No stops match these filters.</p>
        <p className="mt-1 text-[11.5px] text-muted">
          Clear a filter, change the tab, or search for a different keyword.
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stops.map((s) => (
        <StopCard
          key={s.id}
          stop={s}
          highlighted={s.id === focusedId}
          onPreview={() => onOpen(s.id)}
          onImport={() => onOpen(s.id) /* drawer's Import button handles it */}
        />
      ))}
    </div>
  )
}
