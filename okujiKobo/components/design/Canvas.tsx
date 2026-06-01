'use client'

import { useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { safeUpdate } from '@/lib/design/persist'
import {
  usePassportStore,
  selectActivePage,
  selectActivePageStops,
} from '@/lib/design/passport-store'
import { PageBackground } from './PageBackground'
import { LocationBox } from './LocationBox'
import { PageElementBox } from './PageElementBox'
import { LineElementBox } from './LineElementBox'
import type { LinePageElement } from '@/lib/design/types'
import { isLineEl, isBoxEl } from '@/lib/design/types'

const ARTBOARD_W = 612
const ARTBOARD_H = 792

export function Canvas() {
  const activePage = usePassportStore(selectActivePage)
  const stops = usePassportStore(useShallow(selectActivePageStops))
  const selectedStopId = usePassportStore((s) => s.selectedStopId)
  const selectedElementId = usePassportStore((s) => s.selectedElementId)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)
  const updateStop = usePassportStore((s) => s.updateStop)
  const updateElement = usePassportStore((s) => s.updateElement)

  const [zoom, setZoom] = useState(1)

  // Drag handlers fire onChange on EVERY pointer move (~60/sec). Sending
  // a Supabase UPDATE per move pegged the DB connection and triggered a
  // 57014 "canceling statement due to statement timeout" once enough
  // writes piled up. Debounce the persist per-id so the local store
  // still updates instantly for visual feedback, but only the final
  // position is written to the DB ~250ms after the last change.
  const persistTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const PERSIST_DEBOUNCE_MS = 250

  const scheduleStopPersist = useCallback((id: string, patch: Record<string, unknown>) => {
    const key = `stop:${id}`
    const prev = persistTimers.current.get(key)
    if (prev) clearTimeout(prev)
    persistTimers.current.set(
      key,
      setTimeout(() => {
        persistTimers.current.delete(key)
        void safeUpdate('stops', patch, 'id', id)
      }, PERSIST_DEBOUNCE_MS),
    )
  }, [])

  const schedulePagePersist = useCallback((pageId: string, elements: unknown[]) => {
    const key = `page:${pageId}`
    const prev = persistTimers.current.get(key)
    if (prev) clearTimeout(prev)
    persistTimers.current.set(
      key,
      setTimeout(() => {
        persistTimers.current.delete(key)
        void safeUpdate('passport_pages', { elements }, 'id', pageId)
      }, PERSIST_DEBOUNCE_MS),
    )
  }, [])

  const handleStopChange = useCallback(
    (id: string, patch: Parameters<typeof updateStop>[1]) => {
      updateStop(id, patch)
      scheduleStopPersist(id, patch as Record<string, unknown>)
    },
    [updateStop, scheduleStopPersist],
  )

  const handleElementChange = useCallback(
    (pageId: string, elementId: string, patch: Partial<DesignerPageElement>) => {
      const updated = updateElement(pageId, elementId, patch)
      schedulePagePersist(pageId, updated)
    },
    [updateElement, schedulePagePersist],
  )

  const handleZoomIn = () =>
    setZoom((z) => Math.min(2, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () =>
    setZoom((z) => Math.max(0.25, parseFloat((z - 0.1).toFixed(1))))

  const handleDeselect = useCallback(() => {
    setSelectedStop(null)
    setSelectedElement(null)
  }, [setSelectedStop, setSelectedElement])

  if (!activePage) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper">
        <p className="text-sm text-muted">No page selected</p>
      </div>
    )
  }

  const elements = activePage.elements ?? []

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-paper">
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={handleDeselect}
      >
        <div
          className="relative shrink-0 shadow-xl"
          style={{ width: ARTBOARD_W * zoom, height: ARTBOARD_H * zoom }}
          onClick={(e) => e.stopPropagation()}
        >
          <PageBackground page={activePage}>
            {/* Elements layer (below stops) */}
            {elements.map((el) =>
              isLineEl(el) ? (
                <LineElementBox
                  key={el.id}
                  element={el}
                  isSelected={el.id === selectedElementId}
                  scale={zoom}
                  onSelect={() => setSelectedElement(el.id)}
                  onChange={(patch) => handleElementChange(activePage.id, el.id, patch as Partial<LinePageElement>)}
                />
              ) : isBoxEl(el) ? (
                <PageElementBox
                  key={el.id}
                  element={el}
                  isSelected={el.id === selectedElementId}
                  scale={zoom}
                  onSelect={() => setSelectedElement(el.id)}
                  onChange={(patch) => handleElementChange(activePage.id, el.id, patch)}
                />
              ) : null
            )}

            {/* Stops layer */}
            {stops.map((stop) => (
              <LocationBox
                key={stop.id}
                stop={stop}
                isSelected={stop.id === selectedStopId}
                scale={zoom}
                onSelect={() => setSelectedStop(stop.id)}
                onDeselect={handleDeselect}
                onChange={(patch) => handleStopChange(stop.id, patch)}
              />
            ))}

            {stops.length === 0 && elements.length === 0 && (
              <div className="flex h-full items-center justify-center pointer-events-none">
                <p className="rounded-panel border border-dashed border-hairline px-4 py-2 text-xs text-muted/50">
                  Add a stop or label from the left panel
                </p>
              </div>
            )}
          </PageBackground>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-card border border-hairline bg-white px-2 py-1 shadow-sm">
        <button
          className="px-2 py-0.5 text-sm text-muted hover:text-navy transition-colors"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-muted">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="px-2 py-0.5 text-sm text-muted hover:text-navy transition-colors"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="ml-1 border-l border-hairline pl-2 text-xs text-muted hover:text-navy transition-colors"
          onClick={() => setZoom(1)}
          title="Reset zoom"
        >
          Reset
        </button>
      </div>
    </main>
  )
}
