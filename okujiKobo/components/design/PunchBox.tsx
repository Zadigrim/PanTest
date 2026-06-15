'use client'

import { useRef, useCallback } from 'react'
import type { DesignerPunch } from '@/lib/design/types'
import { StampPreview } from './StampPreview'

// The moichido analogue of LocationBox: a placeable design-time punch slot.
// Position + size + rotation + optional label only — NO location, GPS, or
// verification machinery (a punch is a boolean increment). Drag / resize /
// rotate mechanics mirror LocationBox so the two canvases feel identical.
// The MARK rendered inside each slot is the card-level punch mark (passport
// punch_type/punch_icon/punch_asset_id) — one mark per card.

const ROT_HANDLE_OFFSET = 28
const MIN_SIZE = 32
const PUNCH_INK = '0F4C5C' // moichido teal, hex without # (StampPreview adds it)

// The card-level punch mark, passed down from the canvas.
export interface PunchMark {
  type: 'emoji' | 'custom_asset'
  icon: string
  assetId: string | null
}

interface Props {
  punch: DesignerPunch
  index: number
  isSelected: boolean
  mark: PunchMark
  /** Canvas scale factor (zoom). Converts screen px → artboard px. */
  scale?: number
  onSelect: () => void
  onChange: (patch: {
    box_x?: number
    box_y?: number
    box_width?: number
    box_height?: number
    rotation?: number
  }) => void
}

export function PunchBox({ punch, index, isSelected, mark, scale = 1, onSelect, onChange }: Props) {
  const x = punch.box_x ?? 40
  const y = punch.box_y ?? 40
  const w = punch.box_width ?? 80
  const h = punch.box_height ?? 80
  const rotation = punch.rotation ?? 0

  const containerRef = useRef<HTMLDivElement>(null)
  const rotState = useRef<{ cx: number; cy: number } | null>(null)
  const dragState = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null)
  const resizeState = useRef<{
    handle: ResizeHandle
    startMouseX: number; startMouseY: number
    startX: number; startY: number; startW: number; startH: number
  } | null>(null)

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    onSelect()
    dragState.current = { startMouseX: e.clientX, startMouseY: e.clientY, startX: x, startY: y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [x, y, onSelect])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    const dx = (e.clientX - dragState.current.startMouseX) / scale
    const dy = (e.clientY - dragState.current.startMouseY) / scale
    onChange({ box_x: Math.round(dragState.current.startX + dx), box_y: Math.round(dragState.current.startY + dy) })
  }, [scale, onChange])

  const handleDragEnd = useCallback(() => { dragState.current = null }, [])

  // ── Resize ─────────────────────────────────────────────────────────────────
  const startResize = useCallback((e: React.PointerEvent, handle: ResizeHandle) => {
    e.stopPropagation()
    resizeState.current = { handle, startMouseX: e.clientX, startMouseY: e.clientY, startX: x, startY: y, startW: w, startH: h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [x, y, w, h])

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeState.current) return
    const { handle, startMouseX, startMouseY, startX, startY, startW, startH } = resizeState.current
    const dx = (e.clientX - startMouseX) / scale
    const dy = (e.clientY - startMouseY) / scale
    let newX = startX, newY = startY, newW = startW, newH = startH
    if (handle.includes('e')) newW = Math.max(MIN_SIZE, startW + dx)
    if (handle.includes('s')) newH = Math.max(MIN_SIZE, startH + dy)
    if (handle.includes('w')) { const c = Math.min(startW - MIN_SIZE, dx); newX = startX + c; newW = startW - c }
    if (handle.includes('n')) { const c = Math.min(startH - MIN_SIZE, dy); newY = startY + c; newH = startH - c }
    onChange({ box_x: Math.round(newX), box_y: Math.round(newY), box_width: Math.round(newW), box_height: Math.round(newH) })
  }, [scale, onChange])

  const handleResizeEnd = useCallback(() => { resizeState.current = null }, [])

  // ── Rotation ─────────────────────────────────────────────────────────────────
  const startRotation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    rotState.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleRotationMove = useCallback((e: React.PointerEvent) => {
    if (!rotState.current) return
    const { cx, cy } = rotState.current
    const angleDeg = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90
    const normalized = ((Math.round(angleDeg / 15) * 15 % 360) + 360) % 360
    onChange({ rotation: normalized })
  }, [onChange])

  const handleRotationEnd = useCallback(() => { rotState.current = null }, [])

  const ring = Math.min(w, h)

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{ left: x, top: y, width: w, height: h, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: '50% 50%' }}
    >
      <div
        className={`absolute inset-0 cursor-move select-none rounded-sm ${isSelected ? 'shadow-[0_0_0_1px_rgba(15,76,92,0.3)]' : ''}`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        {/* The card-level punch mark fills the slot: a composed SVG
            (custom_asset) re-inked to the moichido teal, or the emoji glyph.
            A small ordinal sits in the corner as a designer aid. */}
        <div className="flex h-full flex-col items-center justify-center gap-1 pointer-events-none">
          {mark.type === 'custom_asset' && mark.assetId ? (
            <StampPreview assetId={mark.assetId} color={PUNCH_INK} size={ring * 0.72} />
          ) : (
            <span style={{ fontSize: ring * 0.6, lineHeight: 1, color: `#${PUNCH_INK}` }}>
              {mark.icon || '⭕'}
            </span>
          )}
          {punch.label && w >= 60 && (
            <span className="max-w-full truncate px-1 text-center text-[9px] font-medium" style={{ color: '#0F4C5C' }}>
              {punch.label}
            </span>
          )}
        </div>

        {isSelected && (
          <div className="absolute -top-5 left-0 whitespace-nowrap rounded-t-sm bg-moichido-teal px-2 py-0.5 text-[10px] font-medium text-white">
            Punch {index + 1}
          </div>
        )}
      </div>

      {/* Rotation handle */}
      {isSelected && (
        <>
          <div className="absolute pointer-events-none" style={{ left: '50%', top: -ROT_HANDLE_OFFSET, width: 1, height: ROT_HANDLE_OFFSET, backgroundColor: '#0EA5E9', transform: 'translateX(-50%)' }} />
          <div
            className="absolute z-30 rounded-full border-2 border-moichido-teal bg-white shadow-sm cursor-grab active:cursor-grabbing"
            style={{ width: 16, height: 16, left: '50%', top: -(ROT_HANDLE_OFFSET + 8), transform: 'translateX(-50%)' }}
            onPointerDown={startRotation}
            onPointerMove={handleRotationMove}
            onPointerUp={handleRotationEnd}
            onPointerCancel={handleRotationEnd}
          />
        </>
      )}

      {/* Resize handles */}
      {isSelected &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle.id}
            className="absolute z-20 h-2.5 w-2.5 rounded-sm border border-moichido-teal bg-white shadow-sm"
            style={{ ...handle.style, cursor: handle.cursor }}
            onPointerDown={(e) => startResize(e, handle.id as ResizeHandle)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
        ))}
    </div>
  )
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_HANDLES: { id: string; style: React.CSSProperties; cursor: string }[] = [
  { id: 'n',  style: { top: -4,    left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'e',  style: { right: -4,  top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'w',  style: { left: -4,   top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'ne', style: { top: -4,    right: -4                                   }, cursor: 'nesw-resize' },
  { id: 'nw', style: { top: -4,    left: -4                                    }, cursor: 'nwse-resize' },
  { id: 'se', style: { bottom: -4, right: -4                                   }, cursor: 'nwse-resize' },
  { id: 'sw', style: { bottom: -4, left: -4                                    }, cursor: 'nwse-resize' },
]
