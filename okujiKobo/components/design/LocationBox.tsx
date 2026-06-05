'use client'

import { useRef, useCallback } from 'react'
import type { DesignerStop } from '@/lib/design/types'
import { StampPreview } from './StampPreview'

const ROT_HANDLE_OFFSET = 28

function hexToRgbComponents(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `${r},${g},${b}`
}

interface Props {
  stop: DesignerStop
  isSelected: boolean
  /** Canvas scale factor (zoom). Used to convert screen px → artboard px. */
  scale?: number
  onSelect: () => void
  onDeselect: () => void
  onChange: (patch: {
    box_x?: number
    box_y?: number
    box_width?: number
    box_height?: number
    rotation?: number
  }) => void
}

const MIN_SIZE = 40

/**
 * Dual-function element: visual stamp container AND bounding box for GPS/QR verification.
 * Center-within rule: stamp center must be inside the box; edges may bleed freely.
 */
export function LocationBox({
  stop,
  isSelected,
  scale = 1,
  onSelect,
  onChange,
}: Props) {
  const x = stop.box_x ?? 40
  const y = stop.box_y ?? 40
  const w = stop.box_width ?? 120
  const h = stop.box_height ?? 120
  const rotation = stop.rotation ?? 0

  const containerRef = useRef<HTMLDivElement>(null)
  const rotState = useRef<{ cx: number; cy: number } | null>(null)

  const dragState = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  } | null>(null)

  const resizeState = useRef<{
    handle: ResizeHandle
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      onSelect()
      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: x,
        startY: y,
      }
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
    },
    [x, y, onSelect],
  )

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      const dx = (e.clientX - dragState.current.startMouseX) / scale
      const dy = (e.clientY - dragState.current.startMouseY) / scale
      onChange({
        box_x: Math.round(dragState.current.startX + dx),
        box_y: Math.round(dragState.current.startY + dy),
      })
    },
    [scale, onChange],
  )

  const handleDragEnd = useCallback(() => {
    dragState.current = null
  }, [])

  // ── Resize ─────────────────────────────────────────────────────────────────
  const startResize = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.stopPropagation()
      resizeState.current = {
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: x,
        startY: y,
        startW: w,
        startH: h,
      }
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
    },
    [x, y, w, h],
  )

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeState.current) return
      const { handle, startMouseX, startMouseY, startX, startY, startW, startH } =
        resizeState.current
      const dx = (e.clientX - startMouseX) / scale
      const dy = (e.clientY - startMouseY) / scale

      let newX = startX,
        newY = startY,
        newW = startW,
        newH = startH

      if (handle.includes('e')) newW = Math.max(MIN_SIZE, startW + dx)
      if (handle.includes('s')) newH = Math.max(MIN_SIZE, startH + dy)
      if (handle.includes('w')) {
        const clamped = Math.min(startW - MIN_SIZE, dx)
        newX = startX + clamped
        newW = startW - clamped
      }
      if (handle.includes('n')) {
        const clamped = Math.min(startH - MIN_SIZE, dy)
        newY = startY + clamped
        newH = startH - clamped
      }

      onChange({
        box_x: Math.round(newX),
        box_y: Math.round(newY),
        box_width: Math.round(newW),
        box_height: Math.round(newH),
      })
    },
    [scale, onChange],
  )

  const handleResizeEnd = useCallback(() => {
    resizeState.current = null
  }, [])

  // ── Rotation ─────────────────────────────────────────────────────────────────
  const startRotation = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      rotState.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handleRotationMove = useCallback(
    (e: React.PointerEvent) => {
      if (!rotState.current) return
      const { cx, cy } = rotState.current
      const angleRad = Math.atan2(e.clientY - cy, e.clientX - cx)
      const angleDeg = angleRad * (180 / Math.PI) + 90
      const snapped = Math.round(angleDeg / 15) * 15
      const normalized = ((snapped % 360) + 360) % 360
      onChange({ rotation: normalized })
    },
    [onChange],
  )

  const handleRotationEnd = useCallback(() => { rotState.current = null }, [])

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: x, top: y, width: w, height: h,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: '50% 50%',
      }}
    >
      {/* Main box — drag target. Border uses ink color at 50% opacity */}
      <div
        className={`absolute inset-0 cursor-move select-none rounded-sm transition-[border-color] ${
          isSelected ? 'border-2 shadow-[0_0_0_1px_rgba(29,158,117,0.3)]' : 'border'
        }`}
        style={{
          borderColor: isSelected
            ? `#${stop.stamp_color ?? '1D9E75'}`
            : `rgba(${hexToRgbComponents(stop.stamp_color ?? '1D9E75')},0.5)`,
          borderStyle: isSelected ? 'solid' : 'dashed',
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        {/* Stamp preview — centered inside box. Branch:
              - custom_asset → StampPreview (re-inks SVG via
                currentColor + wrapper color; raster falls back
                to <img> with no recolor, parity with mobile).
              - emoji (default) → existing span render. */}
        <div className="flex h-full flex-col items-center justify-center gap-1 pointer-events-none">
          {stop.stamp_type === 'custom_asset' && stop.stamp_asset_id ? (
            <StampPreview
              assetId={stop.stamp_asset_id}
              color={stop.stamp_color}
              size={Math.min(w, h) * 0.7}
            />
          ) : (
            <span
              className="leading-none"
              style={{
                fontSize: Math.min(w, h) * 0.4,
                color: `#${stop.stamp_color ?? '1D9E75'}`,
              }}
            >
              {stop.stamp_icon ?? '📍'}
            </span>
          )}
          {w >= 80 && (
            <span
              className="max-w-full truncate px-1 text-center text-[10px] font-medium"
              style={{ color: `#${stop.stamp_color ?? '1D9E75'}` }}
            >
              {stop.name}
            </span>
          )}
        </div>

        {/* Location indicator badge */}
        {isSelected && (
          <div className="absolute -top-5 left-0 whitespace-nowrap rounded-t-sm bg-green px-2 py-0.5 text-[10px] font-medium text-white">
            {stop.name}
          </div>
        )}
      </div>

      {/* Rotation handle (when selected) */}
      {isSelected && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: -ROT_HANDLE_OFFSET,
              width: 1,
              height: ROT_HANDLE_OFFSET,
              backgroundColor: '#0EA5E9',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            className="absolute z-30 rounded-full border-2 border-green bg-white shadow-sm cursor-grab active:cursor-grabbing"
            style={{
              width: 16, height: 16,
              left: '50%',
              top: -(ROT_HANDLE_OFFSET + 8),
              transform: 'translateX(-50%)',
            }}
            onPointerDown={startRotation}
            onPointerMove={handleRotationMove}
            onPointerUp={handleRotationEnd}
            onPointerCancel={handleRotationEnd}
          />
        </>
      )}

      {/* Resize handles (8-point, only when selected) */}
      {isSelected &&
        RESIZE_HANDLES.map((handle) => (
          <ResizeHandleEl
            key={handle.id}
            handle={handle}
            onPointerDown={(e) => startResize(e, handle.id as ResizeHandle)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
        ))}
    </div>
  )
}

// ── Resize handles ─────────────────────────────────────────────────────────────

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_HANDLES: { id: string; style: React.CSSProperties; cursor: string }[] = [
  { id: 'n',  style: { top: -4,    left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'e',  style: { right: -4,  top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'w',  style: { left: -4,   top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'ne', style: { top: -4,    right: -4                                   }, cursor: 'nesw-resize' },
  { id: 'nw', style: { top: -4,    left: -4                                    }, cursor: 'nwse-resize' },
  { id: 'se', style: { bottom: -4, right: -4                                   }, cursor: 'nwse-resize' },
  { id: 'sw', style: { bottom: -4, left: -4                                    }, cursor: 'nesw-resize' },
]

function ResizeHandleEl({
  handle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  handle: (typeof RESIZE_HANDLES)[number]
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className="absolute z-20 h-2.5 w-2.5 rounded-sm border border-green bg-white shadow-sm"
      style={{ ...handle.style, cursor: handle.cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  )
}
