'use client'

import { useCallback, useRef, useState } from 'react'
import { STAMP_SURFACE_SIZE, type ComposerElement, type ComposerMetadata } from '@/lib/design/stamp-composer/types'

/**
 * Stamp Composer canvas — the live editing surface.
 *
 * Renders the document inline as one <svg> so currentColor flows
 * naturally (no color picker per element; the wrapper sets the
 * preview ink). Click-to-select; drag-to-move on the element
 * body; drag-to-resize on the bottom-right handle; drag-to-rotate
 * on the top handle. Coordinates stay in the viewBox's 256-unit
 * space — display size is decoupled from logic.
 */

const DISPLAY_PX = 480  // on-screen size of the 256-unit canvas
const SCALE = DISPLAY_PX / STAMP_SURFACE_SIZE

type Patch = Partial<ComposerElement>

interface Props {
  doc: ComposerMetadata
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Patch) => void
}

export function ComposerCanvas({ doc, selectedId, onSelect, onUpdate }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div
      className="relative bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
      style={{ width: DISPLAY_PX, height: DISPLAY_PX, color: '#1f1d1a' }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${doc.surface.w} ${doc.surface.h}`}
        width={DISPLAY_PX}
        height={DISPLAY_PX}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        onMouseDown={(e) => {
          // Background click clears selection.
          if (e.target === svgRef.current) onSelect(null)
        }}
        style={{ touchAction: 'none', cursor: 'default' }}
      >
        {doc.elements.map((el) => (
          <ElementGroup
            key={el.id}
            el={el}
            selected={el.id === selectedId}
            onSelect={() => onSelect(el.id)}
            onUpdate={(patch) => onUpdate(el.id, patch)}
            svgRef={svgRef}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Per-element render + drag/resize/rotate handles ─────────────────────────

interface ElementGroupProps {
  el: ComposerElement
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Patch) => void
  svgRef: React.RefObject<SVGSVGElement>
}

function ElementGroup({ el, selected, onSelect, onUpdate, svgRef }: ElementGroupProps) {
  // Drag state: pointer-down captures starting svg coords + the
  // element's original geometry; pointermove patches the delta.
  const dragStart = useRef<{ sx: number; sy: number; el: ComposerElement } | null>(null)
  const [mode, setMode] = useState<'idle' | 'move' | 'resize' | 'rotate'>('idle')

  const beginDrag = useCallback((e: React.PointerEvent, m: 'move' | 'resize' | 'rotate') => {
    e.stopPropagation()
    onSelect()
    const pt = svgPoint(svgRef.current, e.clientX, e.clientY)
    if (!pt) return
    dragStart.current = { sx: pt.x, sy: pt.y, el: el }
    setMode(m)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [el, onSelect, svgRef])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (mode === 'idle' || !dragStart.current) return
    const pt = svgPoint(svgRef.current, e.clientX, e.clientY)
    if (!pt) return
    const dx = pt.x - dragStart.current.sx
    const dy = pt.y - dragStart.current.sy
    const original = dragStart.current.el

    if (mode === 'move') {
      onUpdate(translatePatch(original, dx, dy))
    } else if (mode === 'resize') {
      onUpdate(resizePatch(original, dx, dy))
    } else if (mode === 'rotate') {
      const c = elementCenter(original)
      const angle = Math.atan2(pt.y - c.y, pt.x - c.x) * 180 / Math.PI + 90
      onUpdate({ rotation: snapAngle(angle) } as Patch)
    }
  }, [mode, onUpdate, svgRef])

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (mode !== 'idle') {
      setMode('idle')
      dragStart.current = null
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    }
  }, [mode])

  return (
    <g
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* The rendered shape itself. */}
      <ElementShape el={el} />

      {/* Transparent hit target — slightly thicker than the
          actual stroke so thin lines stay grabbable. */}
      <ElementHitTarget
        el={el}
        onPointerDown={(e) => beginDrag(e, 'move')}
      />

      {/* Selection overlay + handles. */}
      {selected && (
        <SelectionOverlay
          el={el}
          onResizePointerDown={(e) => beginDrag(e, 'resize')}
          onRotatePointerDown={(e) => beginDrag(e, 'rotate')}
        />
      )}
    </g>
  )
}

// ── Element shape (renders identically to svg.ts output) ────────────────────

function ElementShape({ el }: { el: ComposerElement }) {
  const transform = el.rotation
    ? `rotate(${el.rotation} ${elementCenter(el).x} ${elementCenter(el).y})`
    : undefined

  if (el.type === 'rect') {
    return (
      <rect
        x={el.x} y={el.y} width={el.w} height={el.h}
        rx={el.rx ?? 0}
        fill={el.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={el.strokeWidth}
        strokeDasharray={el.dashed ? `${el.strokeWidth * 3} ${el.strokeWidth * 2}` : undefined}
        transform={transform}
      />
    )
  }
  if (el.type === 'ellipse') {
    return (
      <ellipse
        cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry}
        fill={el.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={el.strokeWidth}
        strokeDasharray={el.dashed ? `${el.strokeWidth * 3} ${el.strokeWidth * 2}` : undefined}
        transform={transform}
      />
    )
  }
  if (el.type === 'line') {
    return (
      <line
        x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
        stroke="currentColor"
        strokeWidth={el.strokeWidth}
        strokeDasharray={el.dashed ? `${el.strokeWidth * 3} ${el.strokeWidth * 2}` : undefined}
        strokeLinecap={el.linecap ?? 'butt'}
        transform={transform}
      />
    )
  }
  // Push 2+ — text / curvedText / icon / traced rendered here.
  return null
}

// ── Hit target — invisible, thicker stroke so thin lines stay grabbable ────

function ElementHitTarget({ el, onPointerDown }: { el: ComposerElement; onPointerDown: (e: React.PointerEvent) => void }) {
  const transform = el.rotation
    ? `rotate(${el.rotation} ${elementCenter(el).x} ${elementCenter(el).y})`
    : undefined
  const common = {
    fill: 'transparent' as const,
    stroke: 'transparent' as const,
    strokeWidth: 16,
    onPointerDown,
    style: { cursor: 'move' as const },
    transform,
  }
  if (el.type === 'rect')    return <rect    x={el.x}  y={el.y}  width={el.w}  height={el.h}  rx={el.rx ?? 0} {...common} />
  if (el.type === 'ellipse') return <ellipse cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} {...common} />
  if (el.type === 'line')    return <line    x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}  {...common} />
  return null
}

// ── Selection overlay + handles ─────────────────────────────────────────────

function SelectionOverlay({
  el,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  el: ComposerElement
  onResizePointerDown: (e: React.PointerEvent) => void
  onRotatePointerDown: (e: React.PointerEvent) => void
}) {
  const bb = elementBoundingBox(el)
  if (!bb) return null
  const c = elementCenter(el)
  const rot = el.rotation ?? 0
  const transform = rot ? `rotate(${rot} ${c.x} ${c.y})` : undefined

  // Handles are drawn in screen-stable coords by counter-scaling
  // would be ideal — but the canvas already counter-scales the
  // svg viewport, so render handles at viewBox-units. A 6-unit
  // square reads as ~11px on the 480px canvas. Acceptable in
  // the composer; can refine later.
  const HANDLE = 6
  return (
    <g transform={transform} style={{ pointerEvents: 'auto' }}>
      <rect
        x={bb.x} y={bb.y} width={bb.w} height={bb.h}
        fill="none" stroke="#1d9e75" strokeWidth={1} strokeDasharray="3 2"
      />
      {/* Resize handle — bottom-right */}
      <rect
        x={bb.x + bb.w - HANDLE / 2}
        y={bb.y + bb.h - HANDLE / 2}
        width={HANDLE} height={HANDLE}
        fill="#1d9e75" stroke="#fff" strokeWidth={1}
        style={{ cursor: 'nwse-resize' }}
        onPointerDown={onResizePointerDown}
      />
      {/* Rotate handle — above top-center */}
      <line
        x1={bb.x + bb.w / 2} y1={bb.y}
        x2={bb.x + bb.w / 2} y2={bb.y - 14}
        stroke="#1d9e75" strokeWidth={1}
      />
      <circle
        cx={bb.x + bb.w / 2} cy={bb.y - 14} r={4}
        fill="#1d9e75" stroke="#fff" strokeWidth={1}
        style={{ cursor: 'grab' }}
        onPointerDown={onRotatePointerDown}
      />
    </g>
  )
}

// ── Geometry helpers ────────────────────────────────────────────────────────

function elementCenter(el: ComposerElement): { x: number; y: number } {
  if (el.type === 'rect')    return { x: el.x + el.w / 2, y: el.y + el.h / 2 }
  if (el.type === 'ellipse') return { x: el.cx, y: el.cy }
  if (el.type === 'line')    return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }
  // Future elements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = el as any
  return { x: a.x ?? 0, y: a.y ?? 0 }
}

function elementBoundingBox(el: ComposerElement): { x: number; y: number; w: number; h: number } | null {
  if (el.type === 'rect')    return { x: el.x, y: el.y, w: el.w, h: el.h }
  if (el.type === 'ellipse') return { x: el.cx - el.rx, y: el.cy - el.ry, w: el.rx * 2, h: el.ry * 2 }
  if (el.type === 'line') {
    const x = Math.min(el.x1, el.x2)
    const y = Math.min(el.y1, el.y2)
    const w = Math.abs(el.x2 - el.x1)
    const h = Math.abs(el.y2 - el.y1)
    // Lines collapse to 0 in one axis — pad for handle visibility.
    return { x: x - 2, y: y - 2, w: Math.max(w, 4), h: Math.max(h, 4) }
  }
  return null
}

function translatePatch(el: ComposerElement, dx: number, dy: number): Patch {
  if (el.type === 'rect')    return { x: el.x + dx, y: el.y + dy } as Patch
  if (el.type === 'ellipse') return { cx: el.cx + dx, cy: el.cy + dy } as Patch
  if (el.type === 'line')    return { x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy } as Patch
  return {}
}

function resizePatch(el: ComposerElement, dx: number, dy: number): Patch {
  if (el.type === 'rect')    return { w: Math.max(4, el.w + dx), h: Math.max(4, el.h + dy) } as Patch
  if (el.type === 'ellipse') return { rx: Math.max(2, el.rx + dx / 2), ry: Math.max(2, el.ry + dy / 2) } as Patch
  if (el.type === 'line')    return { x2: el.x2 + dx, y2: el.y2 + dy } as Patch
  return {}
}

/** Snap rotation to 15° increments when within 3° — feels like
 *  the kind of helpful nudge a non-designer expects. */
function snapAngle(deg: number): number {
  const STEP = 15
  const snap = Math.round(deg / STEP) * STEP
  return Math.abs(deg - snap) < 3 ? snap : deg
}

/** Convert client coords → svg viewBox coords. Necessary because
 *  the svg displays at DISPLAY_PX but its logic is in 256 units. */
function svgPoint(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  return {
    x: (clientX - rect.left) / SCALE,
    y: (clientY - rect.top)  / SCALE,
  }
}

