'use client'

import { useRef, useCallback } from 'react'
import type { DesignerPageElement } from '@/lib/design/types'

interface Props {
  element: DesignerPageElement
  isSelected: boolean
  scale?: number
  onSelect: () => void
  onChange: (patch: Partial<DesignerPageElement>) => void
}

export function PageElementBox({
  element,
  isSelected,
  scale = 1,
  onSelect,
  onChange,
}: Props) {
  const { x, y, width, height } = element
  const dragState = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

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

  const handlePointerUp = useCallback(() => {
    dragState.current = null
  }, [])

  return (
    <div
      className="absolute cursor-move select-none"
      style={{ left: x, top: y, width, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 rounded-sm ring-2 ring-panoply-teal ring-offset-1 pointer-events-none" />
      )}

      {element.type === 'text' && (
        <div
          className="h-full w-full flex items-center overflow-hidden"
          style={{
            fontSize: element.fontSize ?? 14,
            fontWeight: element.fontWeight ?? 'normal',
            color: `#${element.color ?? '0D1B2A'}`,
            justifyContent:
              element.align === 'center'
                ? 'center'
                : element.align === 'right'
                ? 'flex-end'
                : 'flex-start',
          }}
        >
          <span className={!element.content ? 'italic text-panoply-gray-3/50' : ''}>
            {element.content || 'Label text…'}
          </span>
        </div>
      )}

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

      {/* Dashed hit-area border when not selected */}
      {!isSelected && (
        <div className="absolute inset-0 rounded-sm border border-dashed border-panoply-gray-3/30 pointer-events-none" />
      )}
    </div>
  )
}
