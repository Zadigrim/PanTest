'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  usePassportStore,
  selectActivePage,
  selectActivePageStops,
} from '@/lib/stores/passport-store'
import { PageBackground } from './PageBackground'
import { LocationBox } from './LocationBox'

const ARTBOARD_W = 612
const ARTBOARD_H = 792

export function Canvas() {
  const activePage = usePassportStore(selectActivePage)
  const stops = usePassportStore(selectActivePageStops)
  const selectedStopId = usePassportStore((s) => s.selectedStopId)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const updateStop = usePassportStore((s) => s.updateStop)
  const markDirty = usePassportStore((s) => s.markDirty)

  const [zoom, setZoom] = useState(1)

  const handleStopChange = useCallback(
    async (id: string, patch: Parameters<typeof updateStop>[1]) => {
      updateStop(id, patch)
      markDirty()
      const supabase = createClient()
      await supabase.from('stops').update(patch).eq('id', id)
    },
    [updateStop, markDirty],
  )

  const handleZoomIn = () => setZoom((z) => Math.min(2, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, parseFloat((z - 0.1).toFixed(1))))

  if (!activePage) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panoply-gray-1">
        <p className="text-sm text-panoply-gray-3">No page selected</p>
      </div>
    )
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-panoply-gray-1">
      {/* Scrollable canvas area — click background to deselect */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={() => setSelectedStop(null)}
      >
        {/* Artboard at current zoom */}
        <div
          className="relative shrink-0 shadow-xl"
          style={{
            width: ARTBOARD_W * zoom,
            height: ARTBOARD_H * zoom,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <PageBackground page={activePage}>
            {stops.map((stop) => (
              <LocationBox
                key={stop.id}
                stop={stop}
                isSelected={stop.id === selectedStopId}
                scale={zoom}
                onSelect={() => setSelectedStop(stop.id)}
                onDeselect={() => setSelectedStop(null)}
                onChange={(patch) => handleStopChange(stop.id, patch)}
              />
            ))}

            {stops.length === 0 && (
              <div className="flex h-full items-center justify-center pointer-events-none">
                <p className="rounded-panel border border-dashed border-panoply-gray-2 px-4 py-2 text-xs text-panoply-gray-3/50">
                  Add a stop from the left panel
                </p>
              </div>
            )}
          </PageBackground>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-card border border-panoply-gray-2 bg-white px-2 py-1 shadow-sm">
        <button
          className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-panoply-gray-3">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="ml-1 border-l border-panoply-gray-2 pl-2 text-xs text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={() => setZoom(1)}
          title="Reset zoom"
        >
          Reset
        </button>
      </div>
    </main>
  )
}
