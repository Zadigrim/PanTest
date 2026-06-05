'use client'

import { useCallback, useRef, useState } from 'react'
import { STAMP_SURFACE_SIZE, type ComposerElement, type ComposerMetadata } from '@/lib/design/stamp-composer/types'
import { arcPathD, renderText } from '@/lib/design/stamp-composer/geometry'
import { fontByKey } from '@/lib/design/fonts'

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
  if (el.type === 'text') {
    const f = fontByKey(el.fontFamily)
    const txt = renderText(el.text, { uppercase: el.uppercase })
    // Multi-line support: newlines in the textarea become
    // separate <tspan> lines anchored to el.x with dy stepping
    // by line-height. First line carries dy=0; subsequent
    // lines step by 1.2× fontSize (standard line-height).
    const lines = txt.split('\n')
    return (
      <text
        x={el.x}
        y={el.y + el.fontSize * 0.82}
        fontFamily={f.family}
        fontSize={el.fontSize}
        fontWeight={el.bold ? 700 : 400}
        fontStyle={el.italic ? 'italic' : 'normal'}
        letterSpacing={el.letterSpacing ?? undefined}
        fill="currentColor"
        stroke="none"
        transform={transform}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={el.x} dy={i === 0 ? 0 : el.fontSize * 1.2}>
            {/* Empty-line preservation — SVG drops empty
                <tspan> contents; a space keeps the vertical
                advance. */}
            {line || ' '}
          </tspan>
        ))}
      </text>
    )
  }
  if (el.type === 'curvedText') {
    const f = fontByKey(el.fontFamily)
    const txt = renderText(el.text, { uppercase: el.uppercase })
    const pathId = `cp-${el.id}`
    const d = arcPathD(el.cx, el.cy, el.rx, el.ry, el.arc)
    return (
      <g transform={transform}>
        <defs>
          <path id={pathId} d={d} />
        </defs>
        <text
          fontFamily={f.family}
          fontSize={el.fontSize}
          fontWeight={el.bold ? 700 : 400}
          fontStyle={el.italic ? 'italic' : 'normal'}
          letterSpacing={el.letterSpacing ?? undefined}
          fill="currentColor"
          stroke="none"
          textAnchor="middle"
        >
          <textPath href={`#${pathId}`} startOffset="50%">
            {txt}
          </textPath>
        </text>
      </g>
    )
  }
  if (el.type === 'triangle') {
    const pts = `${el.x1},${el.y1} ${el.x2},${el.y2} ${el.x3},${el.y3}`
    return (
      <polygon
        points={pts}
        fill={el.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={el.strokeWidth}
        strokeDasharray={el.dashed ? `${el.strokeWidth * 3} ${el.strokeWidth * 2}` : undefined}
        transform={transform}
      />
    )
  }
  if (el.type === 'icon') {
    // Embed the icon's inner SVG content (captured at pick time)
    // inside a positioning <g>. dangerouslySetInnerHTML on a <g>
    // requires React 18 — we have it. The content is from our
    // own vetted seed (or, later, from public/stamp-icons/),
    // never from arbitrary user input.
    const [, , vbW, vbH] = parseViewBox(el.viewBox)
    const scale = el.size / Math.max(vbW, vbH)
    return (
      <g transform={transform}>
        <g
          transform={`translate(${el.x} ${el.y}) scale(${scale})`}
          stroke="currentColor"
          strokeWidth={el.strokeWidth}
          fill="none"
          dangerouslySetInnerHTML={{ __html: el.svgContent }}
        />
      </g>
    )
  }
  if (el.type === 'traced') {
    // The tracer authored `d` in source-image pixel coordinates.
    // Scale into (x, y, w, h) on the surface.
    const sx = el.w / el.sourceW
    const sy = el.h / el.sourceH
    const filled = el.filled !== false
    return (
      <g transform={transform}>
        <g transform={`translate(${el.x} ${el.y}) scale(${sx} ${sy})`}>
          <path
            d={el.d}
            fill={filled ? 'currentColor' : 'none'}
            fillRule="evenodd"
            stroke={filled ? 'none' : 'currentColor'}
            strokeWidth={filled ? undefined : (el.strokeWidth ?? 1)}
          />
        </g>
      </g>
    )
  }
  return null
}

function parseViewBox(vb: string): [number, number, number, number] {
  const parts = vb.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return [0, 0, 24, 24]
  return [parts[0], parts[1], parts[2], parts[3]]
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
  if (el.type === 'text') {
    // Approximate text bounding box; cheap heuristic since the
    // hit target just needs to be grabbable, not pixel-perfect.
    // Multi-line: widest line drives width; line count drives
    // height.
    const lines = el.text.split('\n')
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
    const w = Math.max(longest * el.fontSize * 0.55, 20)
    const h = Math.max(1, lines.length) * el.fontSize * 1.2
    return <rect x={el.x} y={el.y} width={w} height={h} {...common} />
  }
  if (el.type === 'curvedText') {
    // Wrap the entire arc's bounding box as the hit target.
    return <rect x={el.cx - el.rx} y={el.cy - el.ry} width={el.rx * 2} height={el.ry * 2} {...common} />
  }
  if (el.type === 'triangle') {
    return <polygon points={`${el.x1},${el.y1} ${el.x2},${el.y2} ${el.x3},${el.y3}`} {...common} />
  }
  if (el.type === 'icon') {
    return <rect x={el.x} y={el.y} width={el.size} height={el.size} {...common} />
  }
  if (el.type === 'traced') {
    return <rect x={el.x} y={el.y} width={el.w} height={el.h} {...common} />
  }
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
  if (el.type === 'rect')       return { x: el.x + el.w / 2, y: el.y + el.h / 2 }
  if (el.type === 'ellipse')    return { x: el.cx, y: el.cy }
  if (el.type === 'line')       return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }
  if (el.type === 'text') {
    const lines = el.text.split('\n')
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
    const w = Math.max(longest * el.fontSize * 0.55, 20)
    const h = Math.max(1, lines.length) * el.fontSize * 1.2
    return { x: el.x + w / 2, y: el.y + h / 2 }
  }
  if (el.type === 'curvedText') return { x: el.cx, y: el.cy }
  if (el.type === 'triangle')   return { x: (el.x1 + el.x2 + el.x3) / 3, y: (el.y1 + el.y2 + el.y3) / 3 }
  if (el.type === 'icon')       return { x: el.x + el.size / 2, y: el.y + el.size / 2 }
  if (el.type === 'traced')     return { x: el.x + el.w / 2, y: el.y + el.h / 2 }
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
    return { x: x - 2, y: y - 2, w: Math.max(w, 4), h: Math.max(h, 4) }
  }
  if (el.type === 'text') {
    const lines = el.text.split('\n')
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
    const w = Math.max(longest * el.fontSize * 0.55, 20)
    const h = Math.max(1, lines.length) * el.fontSize * 1.2
    return { x: el.x, y: el.y, w, h }
  }
  if (el.type === 'curvedText') {
    return { x: el.cx - el.rx, y: el.cy - el.ry, w: el.rx * 2, h: el.ry * 2 }
  }
  if (el.type === 'triangle') {
    const xs = [el.x1, el.x2, el.x3]
    const ys = [el.y1, el.y2, el.y3]
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }
  if (el.type === 'icon') {
    return { x: el.x, y: el.y, w: el.size, h: el.size }
  }
  if (el.type === 'traced') {
    return { x: el.x, y: el.y, w: el.w, h: el.h }
  }
  return null
}

function translatePatch(el: ComposerElement, dx: number, dy: number): Patch {
  if (el.type === 'rect')       return { x: el.x + dx, y: el.y + dy } as Patch
  if (el.type === 'ellipse')    return { cx: el.cx + dx, cy: el.cy + dy } as Patch
  if (el.type === 'line')       return { x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy } as Patch
  if (el.type === 'text')       return { x: el.x + dx, y: el.y + dy } as Patch
  if (el.type === 'curvedText') return { cx: el.cx + dx, cy: el.cy + dy } as Patch
  if (el.type === 'triangle')   return {
    x1: el.x1 + dx, y1: el.y1 + dy,
    x2: el.x2 + dx, y2: el.y2 + dy,
    x3: el.x3 + dx, y3: el.y3 + dy,
  } as Patch
  if (el.type === 'icon')       return { x: el.x + dx, y: el.y + dy } as Patch
  if (el.type === 'traced')     return { x: el.x + dx, y: el.y + dy } as Patch
  return {}
}

function resizePatch(el: ComposerElement, dx: number, dy: number): Patch {
  if (el.type === 'rect')    return { w: Math.max(4, el.w + dx), h: Math.max(4, el.h + dy) } as Patch
  if (el.type === 'ellipse') return { rx: Math.max(2, el.rx + dx / 2), ry: Math.max(2, el.ry + dy / 2) } as Patch
  if (el.type === 'line')    return { x2: el.x2 + dx, y2: el.y2 + dy } as Patch
  if (el.type === 'text') {
    // Resize handle on text scales the font size — dx is the
    // dominant axis. Floor at 6pt.
    return { fontSize: Math.max(6, el.fontSize + dx * 0.4) } as Patch
  }
  if (el.type === 'curvedText') {
    return { rx: Math.max(8, el.rx + dx / 2), ry: Math.max(8, el.ry + dy / 2) } as Patch
  }
  if (el.type === 'triangle') {
    // Uniform scale of the three points around the centroid.
    // dx is the dominant axis; clamp to keep the triangle from
    // collapsing.
    const cx = (el.x1 + el.x2 + el.x3) / 3
    const cy = (el.y1 + el.y2 + el.y3) / 3
    const factor = 1 + dx / 80
    const f = Math.max(0.25, factor)
    return {
      x1: cx + (el.x1 - cx) * f, y1: cy + (el.y1 - cy) * f,
      x2: cx + (el.x2 - cx) * f, y2: cy + (el.y2 - cy) * f,
      x3: cx + (el.x3 - cx) * f, y3: cy + (el.y3 - cy) * f,
    } as Patch
  }
  if (el.type === 'icon') {
    return { size: Math.max(8, el.size + dx) } as Patch
  }
  if (el.type === 'traced') {
    // Preserve aspect ratio on resize — the dominant axis (dx)
    // drives scale; the other axis follows.
    const aspect = el.h / Math.max(1, el.w)
    const nextW = Math.max(8, el.w + dx)
    return { w: nextW, h: nextW * aspect } as Patch
  }
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

