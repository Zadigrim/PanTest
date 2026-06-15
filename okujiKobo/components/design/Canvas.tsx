'use client'

import { useState, useCallback, useContext } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  usePassportStore,
  selectActivePage,
  selectActivePageStops,
  selectActivePagePunches,
} from '@/lib/design/passport-store'
import { PageBackground } from './PageBackground'
import { LocationBox } from './LocationBox'
import { PunchBox } from './PunchBox'
import { PageElementBox } from './PageElementBox'
import { LineElementBox } from './LineElementBox'
import { PunchGridContext, snapToGrid } from '@/lib/design/punch-grid'
import type { LinePageElement, DesignerPageElement } from '@/lib/design/types'
import { isLineEl, isBoxEl } from '@/lib/design/types'

const ARTBOARD_W = 612
const ARTBOARD_H = 869

export function Canvas() {
  const activePage = usePassportStore(selectActivePage)
  const stops = usePassportStore(useShallow(selectActivePageStops))
  const punches = usePassportStore(useShallow(selectActivePagePunches))
  // Consumable (moichido) cards author placeable punch slots instead of
  // GPS stops; persistent passports never have punchSlots, so this branch
  // is inert for the okuji designer.
  const isConsumable = usePassportStore((s) => s.passport?.credential_type === 'consumable')
  // Card-level punch mark (one per card) rendered in every punch slot.
  const punchMark = usePassportStore(
    useShallow((s) => ({
      type: s.passport?.punch_type ?? 'emoji',
      icon: s.passport?.punch_icon ?? '⭕',
      assetId: s.passport?.punch_asset_id ?? null,
    })),
  )
  const selectedStopId = usePassportStore((s) => s.selectedStopId)
  const selectedPunchId = usePassportStore((s) => s.selectedPunchId)
  const selectedElementId = usePassportStore((s) => s.selectedElementId)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const setSelectedPunch = usePassportStore((s) => s.setSelectedPunch)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)
  const updateStop = usePassportStore((s) => s.updateStop)
  const updatePunch = usePassportStore((s) => s.updatePunch)
  const updateElement = usePassportStore((s) => s.updateElement)

  // Optional snap-to-grid for punches (moichido only; provided by
  // CardWorkspace). Inert for the okuji designer — no provider → disabled.
  const grid = useContext(PunchGridContext)
  const gridOn = isConsumable && grid.enabled

  // Snap a punch drag/resize patch to the grid when it's on. Position always
  // snaps; size snaps but stays at least one cell so a punch never collapses.
  const snapPunchPatch = useCallback(
    (patch: Parameters<typeof updatePunch>[1]): Parameters<typeof updatePunch>[1] => {
      if (!gridOn) return patch
      const out = { ...patch }
      if (typeof out.box_x === 'number') out.box_x = snapToGrid(out.box_x, grid.size)
      if (typeof out.box_y === 'number') out.box_y = snapToGrid(out.box_y, grid.size)
      if (typeof out.box_width === 'number') out.box_width = Math.max(grid.size, snapToGrid(out.box_width, grid.size))
      if (typeof out.box_height === 'number') out.box_height = Math.max(grid.size, snapToGrid(out.box_height, grid.size))
      return out
    },
    [gridOn, grid.size],
  )

  const [zoom, setZoom] = useState(1)

  // Edits are local-only — they update the store (which flags isDirty)
  // and the user clicks Save to persist everything. No DB writes happen
  // per pointer-move, per blur, etc.
  const handleStopChange = useCallback(
    (id: string, patch: Parameters<typeof updateStop>[1]) => {
      updateStop(id, patch)
    },
    [updateStop],
  )

  const handleElementChange = useCallback(
    (pageId: string, elementId: string, patch: Partial<DesignerPageElement>) => {
      updateElement(pageId, elementId, patch)
    },
    [updateElement],
  )

  const handleZoomIn = () =>
    setZoom((z) => Math.min(2, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () =>
    setZoom((z) => Math.max(0.25, parseFloat((z - 0.1).toFixed(1))))

  const handleDeselect = useCallback(() => {
    setSelectedStop(null)
    setSelectedPunch(null)
    setSelectedElement(null)
  }, [setSelectedStop, setSelectedPunch, setSelectedElement])

  if (!activePage) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-canvas">
        <p className="text-sm text-cream/70">No page selected</p>
      </div>
    )
  }

  const elements = activePage.elements ?? []

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-surface-canvas">
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
            {/* Optional snap grid (moichido) — drawn over the page background,
                under the boxes. pointer-events-none so it never blocks drag. */}
            {gridOn && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    `repeating-linear-gradient(to right, rgba(15,76,92,0.13) 0 1px, transparent 1px ${grid.size * zoom}px),` +
                    `repeating-linear-gradient(to bottom, rgba(15,76,92,0.13) 0 1px, transparent 1px ${grid.size * zoom}px)`,
                }}
              />
            )}

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

            {/* Stops layer — persistent passports only. Consumable cards
                render punch slots instead (below). */}
            {!isConsumable && stops.map((stop) => (
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

            {/* Punch slots layer — moichido (consumable) cards only. */}
            {isConsumable && punches.map((punch, i) => (
              <PunchBox
                key={punch.id}
                punch={punch}
                index={i}
                isSelected={punch.id === selectedPunchId}
                mark={punchMark}
                scale={zoom}
                onSelect={() => setSelectedPunch(punch.id)}
                onChange={(patch) => updatePunch(punch.id, snapPunchPatch(patch))}
              />
            ))}

            {(isConsumable ? punches.length === 0 : stops.length === 0) && elements.length === 0 && (
              <div className="flex h-full items-center justify-center pointer-events-none">
                <p className="rounded-panel border border-dashed border-hairline px-4 py-2 text-xs text-muted/50">
                  {isConsumable ? 'Add a punch or label from the left panel' : 'Add a stop or label from the left panel'}
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
