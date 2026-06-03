'use client'

// Read-only renderers for the Explore page viewer. They mirror the
// designer's editing components but strip all interactivity — no drag
// handles, no selection rings, no input handlers — so the same page
// data shows up faithfully in Explore without re-running the editor.

import type {
  DesignerPageElement,
  ImagePageElement,
  TextPageElement,
  LinePageElement,
} from '@/lib/design/types'

interface ViewerStop {
  id: string
  name: string
  box_x: number | null
  box_y: number | null
  box_width: number | null
  box_height: number | null
  rotation: number | null
  stamp_icon: string | null
  stamp_color: string | null
}

export function ReadOnlyStop({ stop }: { stop: ViewerStop }) {
  const x = stop.box_x ?? 40
  const y = stop.box_y ?? 40
  const w = stop.box_width ?? 120
  const h = stop.box_height ?? 120
  const rotation = stop.rotation ?? 0
  const stamp = stop.stamp_icon ?? '📍'
  return (
    <div
      className="absolute flex items-center justify-center rounded-card border-2 border-dashed"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `rotate(${rotation}deg)`,
        borderColor: 'rgba(13, 27, 42, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
      }}
      aria-label={`Stop: ${stop.name}`}
    >
      <span className="select-none text-3xl leading-none opacity-60">{stamp}</span>
    </div>
  )
}

export function ReadOnlyElement({ element }: { element: DesignerPageElement }) {
  if (element.type === 'text') {
    const el = element as TextPageElement
    return (
      <div
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          transformOrigin: 'top left',
          fontSize: el.fontSize ?? 14,
          fontWeight: el.fontWeight ?? 'normal',
          color: `#${el.color ?? '0D1B2A'}`,
          textAlign: el.align ?? 'left',
          fontFamily: el.fontFamily ?? 'Arial, sans-serif',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {el.content ?? ''}
      </div>
    )
  }

  if (element.type === 'image') {
    const el = element as ImagePageElement
    if (!el.imageUrl) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={el.imageUrl}
        alt=""
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          transformOrigin: 'top left',
          opacity: (el.opacity ?? 100) / 100,
          objectFit: 'cover',
        }}
        draggable={false}
      />
    )
  }

  if (element.type === 'hline') {
    const el = element
    return (
      <div
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.thickness ?? 2,
          backgroundColor: `#${el.lineColor ?? '0D1B2A'}`,
        }}
      />
    )
  }

  if (element.type === 'vline') {
    const el = element
    return (
      <div
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.thickness ?? 2,
          height: el.height,
          backgroundColor: `#${el.lineColor ?? '0D1B2A'}`,
        }}
      />
    )
  }

  if (element.type === 'line') {
    const el = element as LinePageElement
    const minX = Math.min(el.x1, el.x2)
    const minY = Math.min(el.y1, el.y2)
    const w = Math.max(1, Math.abs(el.x2 - el.x1))
    const h = Math.max(1, Math.abs(el.y2 - el.y1))
    return (
      <svg
        aria-hidden
        style={{
          position: 'absolute',
          left: minX,
          top: minY,
          width: w,
          height: h,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <line
          x1={el.x1 - minX}
          y1={el.y1 - minY}
          x2={el.x2 - minX}
          y2={el.y2 - minY}
          stroke={`#${el.lineColor ?? '0D1B2A'}`}
          strokeWidth={el.thickness ?? 2}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return null
}

export type { ViewerStop }
