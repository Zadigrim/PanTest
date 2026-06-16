'use client'

import { useState, useRef, useCallback } from 'react'
import { usePassportStore } from '@/lib/design/passport-store'
import { PageElementBox } from './PageElementBox'
import type { CoverSideData, DesignerPageElement } from '@/lib/design/types'

// ── Dimensions ────────────────────────────────────────────────────────────────
// Cover canvas dimensions — matched to the inside-page artboard (612 × 869).
// Each cover panel is exactly the same size as an inside page. The two
// panels are separated by a 28px spine gutter (≈4 mm) that represents the
// physical fold; the gutter is a real gap in the canvas, not just a visual
// line. 612 + 28 + 612 = 1252 ≈ 180 mm wrap, the real US-passport cover.
export const COVER_W  = 612                          // px per panel — matches inside-page
export const COVER_H  = 869                          // px per panel — matches inside-page
export const SPINE_W  = 28                           // px gutter (≈4 mm) between back and front panels
export const CANVAS_W = COVER_W * 2 + SPINE_W        // 1252 px — full unfolded spread (≈180 mm)

export type CoverFace  = 'outside' | 'inside'
export type CoverPanel = 'front' | 'back'

const DEFAULTS: CoverSideData = {
  front_bg:        '0D1B2A',
  back_bg:         '0D1B2A',
  image_url:       null,
  image_opacity:   80,
  image_position_x: 0.5,
  image_position_y: 0.5,
  image_scale:     1,
  elements:        [],
}

export function getSideData(data: CoverSideData | null | undefined): CoverSideData {
  return { ...DEFAULTS, elements: [], ...(data ?? {}) }
}

// ── CoverCanvas ───────────────────────────────────────────────────────────────

interface Props {
  face: CoverFace
  onFaceChange: (f: CoverFace) => void
  selectedPanel: CoverPanel
  onPanelChange: (p: CoverPanel) => void
}

export function CoverCanvas({ face, onFaceChange, selectedPanel, onPanelChange }: Props) {
  const passport           = usePassportStore((s) => s.passport)
  const updatePassport     = usePassportStore((s) => s.updatePassport)
  const selectedElementId  = usePassportStore((s) => s.selectedElementId)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)
  const [zoom, setZoom] = useState(0.85)

  // Drag state for image repositioning
  const dragRef = useRef<{
    startX: number
    startY: number
    origPx: number
    origPy: number
    canvasW: number
    canvasH: number
  } | null>(null)

  if (!passport) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-canvas">
        <p className="text-sm text-cream/70">Loading…</p>
      </div>
    )
  }

  const sideKey = face === 'outside' ? 'cover_outside_data' : 'cover_inside_data'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (passport as any)[sideKey]
  const side = getSideData(raw)

  // Local-only mutator. Edits update the store; the Save button
  // (WorkspaceClient → saveAll) writes everything to the DB.
  const persistSide = (patch: Partial<CoverSideData>) => {
    const next: CoverSideData = { ...side, ...patch }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: next } as any)
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    // Spine gutter midpoint splits back from front
    onPanelChange(x < COVER_W + SPINE_W / 2 ? 'back' : 'front')
  }

  // Image drag handlers
  const handleImagePointerDown = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    if (!side.image_url) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const canvasEl = e.currentTarget.parentElement!
    const rect = canvasEl.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPx: side.image_position_x,
      origPy: side.image_position_y,
      canvasW: rect.width,
      canvasH: rect.height,
    }
  }, [side.image_position_x, side.image_position_y, side.image_url])

  const handleImagePointerMove = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.canvasW
    const dy = (e.clientY - d.startY) / d.canvasH
    const newPx = Math.max(0, Math.min(1, d.origPx - dx))
    const newPy = Math.max(0, Math.min(1, d.origPy - dy))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: { ...side, image_position_x: newPx, image_position_y: newPy } } as any)
  }, [side, sideKey, updatePassport])

  const handleImagePointerUp = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.canvasW
    const dy = (e.clientY - d.startY) / d.canvasH
    const newPx = Math.max(0, Math.min(1, d.origPx - dx))
    const newPy = Math.max(0, Math.min(1, d.origPy - dy))
    dragRef.current = null
    persistSide({ image_position_x: newPx, image_position_y: newPy })
  }, [side, persistSide]) // eslint-disable-line react-hooks/exhaustive-deps

  const objectPosition = `${side.image_position_x * 100}% ${side.image_position_y * 100}%`

  const elements = side.elements ?? []

  function handleElementChange(elementId: string, patch: Partial<DesignerPageElement>) {
    const nextElements = elements.map((el) => el.id === elementId ? ({ ...el, ...patch } as DesignerPageElement) : el)
    const nextSide: CoverSideData = { ...side, elements: nextElements }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: nextSide } as any)
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-surface-canvas">
      {/* Face toggle */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-b border-hairline bg-surface-chrome py-2">
        {(['outside', 'inside'] as CoverFace[]).map((f) => (
          <button
            key={f}
            onClick={() => onFaceChange(f)}
            className={`rounded-card px-3 py-1 text-sm font-medium capitalize transition-colors ${
              face === f
                ? 'bg-green text-white'
                : 'text-muted hover:text-navy'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-3 text-xs text-muted">
          {side.image_url ? 'Drag image to reposition · Click panel to select' : 'Click a half to select it'}
        </span>
      </div>

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            width: CANVAS_W,
            height: COVER_H,
            flexShrink: 0,
          }}
        >
          {/* Single continuous surface */}
          <div
            role="img"
            aria-label="Cover canvas"
            className="relative overflow-hidden shadow-xl"
            style={{ width: CANVAS_W, height: COVER_H, cursor: side.image_url ? 'default' : 'pointer' }}
            onClick={handleCanvasClick}
          >
            {/* Back half */}
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: COVER_W, backgroundColor: `#${side.back_bg}` }}
            />

            {/* Front half */}
            <div
              className="absolute inset-y-0 right-0"
              style={{ width: COVER_W, backgroundColor: `#${side.front_bg}` }}
            />

            {/* Full-bleed image — draggable to reposition */}
            {side.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={side.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover pointer-events-auto"
                style={{
                  opacity: side.image_opacity / 100,
                  objectPosition,
                  cursor: 'grab',
                  userSelect: 'none',
                  transform: `scale(${side.image_scale})`,
                  transformOrigin: objectPosition,
                }}
                draggable={false}
                onPointerDown={handleImagePointerDown}
                onPointerMove={handleImagePointerMove}
                onPointerUp={handleImagePointerUp}
                onPointerCancel={handleImagePointerUp}
              />
            )}

            {/* Freely-positioned elements (text blocks, lines) */}
            {elements.map((el) => (
              <PageElementBox
                key={el.id}
                element={el as import('react').ComponentProps<typeof PageElementBox>['element']}
                isSelected={el.id === selectedElementId}
                scale={zoom}
                onSelect={() => setSelectedElement(el.id)}
                onChange={(patch) => handleElementChange(el.id, patch)}
              />
            ))}

            {/* Spine fold line — centered in the 24px gutter */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: COVER_W + SPINE_W / 2,
                width: 0,
                borderLeft: '1px dashed rgba(255,255,255,0.35)',
                zIndex: 10,
              }}
            >
              <span
                className="absolute top-2 left-1 text-[9px] select-none"
                style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}
              >
                Spine
              </span>
            </div>

            {/* Selection ring — back half */}
            {selectedPanel === 'back' && (
              <div
                className="absolute inset-y-0 left-0 ring-2 ring-inset ring-green pointer-events-none"
                style={{ width: COVER_W, zIndex: 11 }}
              />
            )}

            {/* Selection ring — front half */}
            {selectedPanel === 'front' && (
              <div
                className="absolute inset-y-0 right-0 ring-2 ring-inset ring-green pointer-events-none"
                style={{ width: COVER_W, zIndex: 11 }}
              />
            )}

            {/* Panel labels */}
            <div className="absolute bottom-2 left-0 flex justify-center pointer-events-none" style={{ width: COVER_W }}>
              <span className="rounded-card bg-black/40 px-2 py-0.5 text-[10px] text-white/60">Back</span>
            </div>
            <div className="absolute bottom-2 right-0 flex justify-center pointer-events-none" style={{ width: COVER_W }}>
              <span className="rounded-card bg-black/40 px-2 py-0.5 text-[10px] text-white/60">Front</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-card border border-hairline bg-white px-2 py-1 shadow-sm">
        <button
          className="px-2 py-0.5 text-sm text-muted hover:text-navy transition-colors"
          onClick={() => setZoom((z) => Math.max(0.3, parseFloat((z - 0.1).toFixed(1))))}
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-muted">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="px-2 py-0.5 text-sm text-muted hover:text-navy transition-colors"
          onClick={() => setZoom((z) => Math.min(2, parseFloat((z + 0.1).toFixed(1))))}
        >
          +
        </button>
        <button
          className="ml-1 border-l border-hairline pl-2 text-xs text-muted hover:text-navy transition-colors"
          onClick={() => setZoom(0.85)}
        >
          Reset
        </button>
      </div>
    </main>
  )
}
