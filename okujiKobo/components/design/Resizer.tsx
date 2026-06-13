'use client'

// A dependency-free draggable divider. orientation 'x' is a vertical bar you
// drag left/right (resizes a width); 'y' is a horizontal bar you drag up/down
// (resizes a height). onDelta gets the incremental pixels since the last move
// (+ = right / down). Double-click fires onReset. Listeners live on window
// during the drag so the pointer can leave the thin handle without dropping.
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  orientation: 'x' | 'y'
  onDelta: (delta: number) => void
  onReset?: () => void
  ariaLabel?: string
  className?: string
}

export function Resizer({ orientation, onDelta, onReset, ariaLabel, className }: Props) {
  const last = useRef<number | null>(null)
  const moveRef = useRef<((e: PointerEvent) => void) | null>(null)
  const endRef = useRef<(() => void) | null>(null)

  const cleanup = useCallback(() => {
    if (moveRef.current) window.removeEventListener('pointermove', moveRef.current)
    if (endRef.current) window.removeEventListener('pointerup', endRef.current)
    moveRef.current = null
    endRef.current = null
    last.current = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // Drop any in-flight drag if the component unmounts mid-drag.
  useEffect(() => cleanup, [cleanup])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    last.current = orientation === 'x' ? e.clientX : e.clientY
    const move = (ev: PointerEvent) => {
      if (last.current == null) return
      const cur = orientation === 'x' ? ev.clientX : ev.clientY
      onDelta(cur - last.current)
      last.current = cur
    }
    const end = () => cleanup()
    moveRef.current = move
    endRef.current = end
    document.body.style.userSelect = 'none'
    document.body.style.cursor = orientation === 'x' ? 'col-resize' : 'row-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }, [orientation, onDelta, cleanup])

  return (
    <div
      role="separator"
      aria-orientation={orientation === 'x' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      className={cn(
        'group relative z-10 shrink-0 bg-hairline/40 transition-colors hover:bg-green/50',
        orientation === 'x' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        className,
      )}
    >
      {/* Widened invisible hit area so the thin bar is easy to grab. */}
      <span
        className={cn(
          'absolute',
          orientation === 'x' ? '-left-1.5 -right-1.5 inset-y-0' : '-top-1.5 -bottom-1.5 inset-x-0',
        )}
      />
    </div>
  )
}
