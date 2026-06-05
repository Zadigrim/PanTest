'use client'

import { useState } from 'react'
import { type ComposerElement, newElementId, STAMP_SURFACE_SIZE } from '@/lib/design/stamp-composer/types'
import { DEFAULT_STAMP_FONT_KEY } from '@/lib/design/fonts'
import { IconPicker } from './IconPicker'

/**
 * Add-element toolbar — sits above the canvas. Shapes ·
 * Text + Curved · Icon picker. Trace-an-image lands in Push 4.
 */
export function ComposerAddToolbar({
  onAdd,
  surface,
}: {
  onAdd: (el: ComposerElement) => void
  surface: number
}) {
  const cx = surface / 2
  const cy = surface / 2
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-white px-3 py-2">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-[2px] text-muted">Add</p>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'rect',
        x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 0,
        strokeWidth: 3,
      })}>
        ▭ <span className="ml-1">Rect</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'rect',
        x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 12,
        strokeWidth: 3,
      })}>
        ▢ <span className="ml-1">Rounded</span>
      </AddButton>

      <AddButton onClick={() => {
        // Equilateral triangle pointing up centered on the canvas.
        // Side length 100; height = 100 * √3 / 2 ≈ 86.6
        const s = 100
        const h = s * Math.sqrt(3) / 2
        onAdd({
          id: newElementId(), type: 'triangle',
          x1: cx,           y1: cy - h * 2 / 3,
          x2: cx - s / 2,   y2: cy + h / 3,
          x3: cx + s / 2,   y3: cy + h / 3,
          strokeWidth: 3,
        })
      }}>
        △ <span className="ml-1">Triangle</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'ellipse',
        cx, cy, rx: 50, ry: 50,
        strokeWidth: 3,
      })}>
        ◯ <span className="ml-1">Circle</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'ellipse',
        cx, cy, rx: 60, ry: 35,
        strokeWidth: 3,
      })}>
        ◯ <span className="ml-1">Ellipse</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'line',
        x1: cx - 50, y1: cy, x2: cx + 50, y2: cy,
        strokeWidth: 3,
      })}>
        ─ <span className="ml-1">Line</span>
      </AddButton>

      <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'text',
        text: 'Text',
        x: cx - 30, y: cy - 12,
        fontSize: 24,
        fontFamily: DEFAULT_STAMP_FONT_KEY,
      })}>
        A <span className="ml-1">Text</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'curvedText',
        text: 'TOP TEXT',
        cx, cy,
        rx: 95, ry: 95,
        arc: 'top',
        fontSize: 18,
        fontFamily: DEFAULT_STAMP_FONT_KEY,
        bold: true,
        uppercase: true,
        letterSpacing: 2,
      })}>
        ⌒ <span className="ml-1">Curved · top</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'curvedText',
        text: 'BOTTOM TEXT',
        cx, cy,
        rx: 95, ry: 95,
        arc: 'bottom',
        fontSize: 18,
        fontFamily: DEFAULT_STAMP_FONT_KEY,
        bold: true,
        uppercase: true,
        letterSpacing: 2,
      })}>
        {/* Mirrored glyph to differentiate from top in the
            toolbar — both buttons add the same element type, the
            arc segment differs. */}
        ⌣ <span className="ml-1">Curved · bottom</span>
      </AddButton>

      <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />

      <AddButton onClick={() => setIconPickerOpen(true)}>
        ★ <span className="ml-1">Icon</span>
      </AddButton>

      {/* Push 4 — potrace tracer. */}
      <DisabledButton title="Push 4 — potrace tracer">⬚ Trace image</DisabledButton>

      <IconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onPick={({ iconKey, svgContent, viewBox }) => onAdd({
          id: newElementId(),
          type: 'icon',
          iconKey,
          svgContent,
          viewBox,
          x: STAMP_SURFACE_SIZE / 2 - 32,
          y: STAMP_SURFACE_SIZE / 2 - 32,
          size: 64,
          strokeWidth: 2,
        })}
      />
    </div>
  )
}

function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-[6px] border-[1.5px] border-hairline bg-white px-2 text-[12px] font-medium text-ink hover:border-ink/40"
    >
      {children}
    </button>
  )
}

function DisabledButton({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className="inline-flex h-8 cursor-not-allowed items-center rounded-[6px] border-[1.5px] border-hairline bg-white px-2 text-[12px] text-hairline"
    >
      {children}
    </button>
  )
}
