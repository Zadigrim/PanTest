'use client'

import { useRef, useCallback } from 'react'
import type {
  TextPageElement,
  ImagePageElement,
  HLinePageElement,
  VLinePageElement,
} from '@/lib/design/types'

type BoxElement = TextPageElement | ImagePageElement | HLinePageElement | VLinePageElement

const MIN_SIZE = 30
const ROT_HANDLE_OFFSET = 28  // px above element in local space

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_HANDLES: { id: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { id: 'n',  style: { top: -4,    left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize'   },
  { id: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize'   },
  { id: 'e',  style: { right: -4,  top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize'   },
  { id: 'w',  style: { left: -4,   top: '50%',  transform: 'translateY(-50%)' }, cursor: 'ew-resize'   },
  { id: 'ne', style: { top: -4,    right: -4 },                                  cursor: 'nesw-resize' },
  { id: 'nw', style: { top: -4,    left: -4  },                                  cursor: 'nwse-resize' },
  { id: 'se', style: { bottom: -4, right: -4 },                                  cursor: 'nwse-resize' },
  { id: 'sw', style: { bottom: -4, left: -4  },                                  cursor: 'nesw-resize' },
]

interface Props {
  element: BoxElement
  isSelected: boolean
  scale?: number
  onSelect: () => void
  onChange: (patch: Partial<BoxElement>) => void
}

export function PageElementBox({
  element,
  isSelected,
  scale = 1,
  onSelect,
  onChange,
}: Props) {
  const { x, y, width, height } = element
  const rotation = (element as TextPageElement | ImagePageElement).rotation ?? 0

  const containerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const resizeState = useRef<{
    handle: ResizeHandle
    startMouseX: number; startMouseY: number
    startX: number; startY: number; startW: number; startH: number
  } | null>(null)
  const rotState = useRef<{ cx: number; cy: number } | null>(null)

  // ── Drag ────────────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      onSelect()
      dragState.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [x, y, onSelect],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      onChange({
        x: Math.round(dragState.current.ox + (e.clientX - dragState.current.sx) / scale),
        y: Math.round(dragState.current.oy + (e.clientY - dragState.current.sy) / scale),
      })
    },
    [scale, onChange],
  )

  const handlePointerUp = useCallback(() => { dragState.current = null }, [])

  // ── Resize ───────────────────────────────────────────────────────────────────

  const startResize = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.stopPropagation()
      resizeState.current = {
        handle,
        startMouseX: e.clientX, startMouseY: e.clientY,
        startX: x, startY: y, startW: width, startH: height,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [x, y, width, height],
  )

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeState.current) return
      const { handle, startMouseX, startMouseY, startX, startY, startW, startH } = resizeState.current
      const dx = (e.clientX - startMouseX) / scale
      const dy = (e.clientY - startMouseY) / scale
      let newX = startX, newY = startY, newW = startW, newH = startH

      if (handle.includes('e')) newW = Math.max(MIN_SIZE, startW + dx)
      if (handle.includes('s')) newH = Math.max(MIN_SIZE, startH + dy)
      if (handle.includes('w')) { const c = Math.min(startW - MIN_SIZE, dx); newX = startX + c; newW = startW - c }
      if (handle.includes('n')) { const c = Math.min(startH - MIN_SIZE, dy); newY = startY + c; newH = startH - c }

      onChange({ x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) })
    },
    [scale, onChange],
  )

  const handleResizeUp = useCallback(() => { resizeState.current = null }, [])

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
      const angleDeg = angleRad * (180 / Math.PI) + 90  // +90 so 0° = up
      const snapped = Math.round(angleDeg / 15) * 15
      const normalized = ((snapped % 360) + 360) % 360
      onChange({ rotation: normalized } as Partial<BoxElement>)
    },
    [onChange],
  )

  const handleRotationUp = useCallback(() => { rotState.current = null }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  const supportsRotation = element.type === 'text' || element.type === 'image'
  const supportsResize   = element.type === 'text' || element.type === 'image'

  return (
    <div
      ref={containerRef}
      className="absolute cursor-move select-none"
      style={{
        left: x, top: y, width, height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: '50% 50%',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 rounded-sm ring-2 ring-panoply-teal ring-offset-1 pointer-events-none" />
      )}

      {/* Text content */}
      {element.type === 'text' && (
        <div className="h-full w-full overflow-hidden flex items-center">
          <div
            className="w-full"
            style={{
              fontSize:   element.fontSize   ?? 14,
              fontWeight: element.fontWeight ?? 'normal',
              fontFamily: element.fontFamily ?? 'Arial, sans-serif',
              color:      `#${element.color ?? '0D1B2A'}`,
              textAlign:  (element.align ?? 'left') as React.CSSProperties['textAlign'],
            }}
          >
            <span className={!element.content ? 'italic text-panoply-gray-3/50' : ''}>
              {element.content || 'Label text…'}
            </span>
          </div>
        </div>
      )}

      {/* Image content */}
      {element.type === 'image' && (
        element.imageUrl ? (
          <img
            src={element.imageUrl}
            alt=""
            className="h-full w-full object-contain pointer-events-none select-none"
            style={{ opacity: (element.opacity ?? 100) / 100 }}
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-sm border-2 border-dashed border-panoply-gray-2 bg-panoply-gray-1/50 text-xs text-panoply-gray-3 pointer-events-none">
            No image — set URL in inspector
          </div>
        )
      )}

      {/* Legacy hline/vline */}
      {element.type === 'hline' && (
        <div
          className="absolute left-0 right-0"
          style={{
            top: '50%',
            height: element.thickness ?? 2,
            backgroundColor: `#${element.lineColor ?? '0D1B2A'}`,
            transform: 'translateY(-50%)',
          }}
        />
      )}
      {element.type === 'vline' && (
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '50%',
            width: element.thickness ?? 2,
            backgroundColor: `#${element.lineColor ?? '0D1B2A'}`,
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {/* Dashed outline when not selected */}
      {!isSelected && (
        <div className="absolute inset-0 rounded-sm border border-dashed border-panoply-gray-3/30 pointer-events-none" />
      )}

      {/* Rotation handle (text/image only, when selected) */}
      {isSelected && supportsRotation && (
        <>
          {/* Stem line */}
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
          {/* Handle circle */}
          <div
            className="absolute z-30 rounded-full border-2 border-panoply-teal bg-white shadow-sm cursor-grab active:cursor-grabbing"
            style={{
              width: 16, height: 16,
              left: '50%',
              top: -(ROT_HANDLE_OFFSET + 8),
              transform: 'translateX(-50%)',
            }}
            onPointerDown={startRotation}
            onPointerMove={handleRotationMove}
            onPointerUp={handleRotationUp}
            onPointerCancel={handleRotationUp}
          />
        </>
      )}

      {/* Resize handles (text/image only, when selected) */}
      {isSelected && supportsResize && RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.id}
          className="absolute z-20 h-2.5 w-2.5 rounded-sm border border-panoply-teal bg-white shadow-sm"
          style={{ ...handle.style, cursor: handle.cursor }}
          onPointerDown={(e) => startResize(e, handle.id)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerCancel={handleResizeUp}
        />
      ))}
    </div>
  )
}
