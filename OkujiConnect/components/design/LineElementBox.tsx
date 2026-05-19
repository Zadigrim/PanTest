'use client'

import { useRef, useCallback } from 'react'
import type { LinePageElement } from '@/lib/design/types'

interface Props {
  element: LinePageElement
  isSelected: boolean
  scale?: number
  onSelect: () => void
  onChange: (patch: Partial<LinePageElement>) => void
}

const HANDLE_R = 5   // handle radius in artboard units

export function LineElementBox({
  element,
  isSelected,
  scale = 1,
  onSelect,
  onChange,
}: Props) {
  const { x1, y1, x2, y2 } = element
  const thickness = element.thickness ?? 2
  const color = `#${element.lineColor ?? '0D1B2A'}`

  // ── Endpoint dragging ────────────────────────────────────────────────────────

  type EndpointState = {
    point: 'start' | 'end'
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
  }
  const epState = useRef<EndpointState | null>(null)

  const startEpDrag = useCallback(
    (e: React.PointerEvent, point: 'start' | 'end') => {
      e.stopPropagation()
      onSelect()
      epState.current = {
        point,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: point === 'start' ? x1 : x2,
        startY: point === 'start' ? y1 : y2,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [x1, y1, x2, y2, onSelect],
  )

  const handleEpMove = useCallback(
    (e: React.PointerEvent) => {
      if (!epState.current) return
      const { point, startMouseX, startMouseY, startX, startY } = epState.current
      const nx = Math.round(startX + (e.clientX - startMouseX) / scale)
      const ny = Math.round(startY + (e.clientY - startMouseY) / scale)
      onChange(point === 'start' ? { x1: nx, y1: ny } : { x2: nx, y2: ny })
    },
    [scale, onChange],
  )

  const handleEpUp = useCallback(() => { epState.current = null }, [])

  // ── Line body click (select only) ────────────────────────────────────────────

  // Bounding box for the SVG host so pointer events work anywhere in the line area
  const minX = Math.min(x1, x2)
  const minY = Math.min(y1, y2)
  const svgW = Math.abs(x2 - x1) + HANDLE_R * 4
  const svgH = Math.abs(y2 - y1) + HANDLE_R * 4
  const offX = minX - HANDLE_R * 2
  const offY = minY - HANDLE_R * 2

  return (
    <svg
      className="absolute pointer-events-none overflow-visible"
      style={{ left: offX, top: offY, width: svgW, height: svgH }}
      viewBox={`${offX} ${offY} ${svgW} ${svgH}`}
    >
      {/* Click target — wide invisible stroke so the line is easy to click */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="transparent"
        strokeWidth={Math.max(12, thickness + 8)}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
      />

      {/* Visible line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth={thickness}
        style={{ pointerEvents: 'none' }}
      />

      {/* Selection highlight */}
      {isSelected && (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#0EA5E9"
          strokeWidth={thickness + 3}
          strokeOpacity={0.35}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Endpoint handles (only when selected) */}
      {isSelected && (
        <>
          {/* Start handle */}
          <foreignObject
            x={x1 - HANDLE_R * 2} y={y1 - HANDLE_R * 2}
            width={HANDLE_R * 4} height={HANDLE_R * 4}
            style={{ pointerEvents: 'auto', overflow: 'visible' }}
          >
            <div
              className="absolute rounded-full border-2 border-okuji-teal bg-white shadow-sm cursor-crosshair"
              style={{
                width: HANDLE_R * 4,
                height: HANDLE_R * 4,
                left: 0, top: 0,
              }}
              onPointerDown={(e) => startEpDrag(e, 'start')}
              onPointerMove={handleEpMove}
              onPointerUp={handleEpUp}
              onPointerCancel={handleEpUp}
            />
          </foreignObject>

          {/* End handle */}
          <foreignObject
            x={x2 - HANDLE_R * 2} y={y2 - HANDLE_R * 2}
            width={HANDLE_R * 4} height={HANDLE_R * 4}
            style={{ pointerEvents: 'auto', overflow: 'visible' }}
          >
            <div
              className="absolute rounded-full border-2 border-okuji-teal bg-white shadow-sm cursor-crosshair"
              style={{
                width: HANDLE_R * 4,
                height: HANDLE_R * 4,
                left: 0, top: 0,
              }}
              onPointerDown={(e) => startEpDrag(e, 'end')}
              onPointerMove={handleEpMove}
              onPointerUp={handleEpUp}
              onPointerCancel={handleEpUp}
            />
          </foreignObject>
        </>
      )}
    </svg>
  )
}
