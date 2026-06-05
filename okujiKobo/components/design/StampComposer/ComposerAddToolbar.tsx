'use client'

import { useState } from 'react'
import { type ComposerElement, newElementId, STAMP_SURFACE_SIZE } from '@/lib/design/stamp-composer/types'
import { DEFAULT_STAMP_FONT_KEY } from '@/lib/design/fonts'
import { IconPicker } from './IconPicker'
import { TraceImagePicker } from './TraceImagePicker'

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
  const [iconPickerOpen,  setIconPickerOpen]  = useState(false)
  const [tracePickerOpen, setTracePickerOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b-[1.5px] border-surface-faintdiv bg-surface-workspace px-3 py-2.5">
      <p className="mr-1 text-[10px] font-bold uppercase tracking-[2px] text-muted">Add</p>

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

      <span className="mx-1 h-5 w-px bg-surface-faintdiv" aria-hidden />

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
        text: 'CURVED TEXT',
        cx, cy,
        rx: 95, ry: 95,
        arc: 'top',
        fontSize: 18,
        fontFamily: DEFAULT_STAMP_FONT_KEY,
        bold: true,
        uppercase: true,
        letterSpacing: 2,
      })}>
        {/* Single button — the inspector's arc segment toggle
            flips top ↔ bottom after add. Two buttons proved
            redundant since the inspector already exposes it. */}
        ⌒ <span className="ml-1">Curved text</span>
      </AddButton>

      <span className="mx-1 h-5 w-px bg-surface-faintdiv" aria-hidden />

      <AddButton emphasis onClick={() => setIconPickerOpen(true)}>
        ★ <span className="ml-1">Icon</span>
      </AddButton>

      <AddButton onClick={() => setTracePickerOpen(true)}>
        ⬚ <span className="ml-1">Trace image</span>
      </AddButton>

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

      <TraceImagePicker
        open={tracePickerOpen}
        onClose={() => setTracePickerOpen(false)}
        onAdd={({ d, sourceW, sourceH }) => {
          // Place at canvas center, fit within ~160 surface units.
          const FIT = 160
          const aspect = sourceH / Math.max(1, sourceW)
          const w = aspect > 1 ? FIT / aspect : FIT
          const h = aspect > 1 ? FIT          : FIT * aspect
          onAdd({
            id: newElementId(),
            type: 'traced',
            d,
            x: STAMP_SURFACE_SIZE / 2 - w / 2,
            y: STAMP_SURFACE_SIZE / 2 - h / 2,
            w,
            h,
            sourceW,
            sourceH,
            filled: true,
          })
        }}
      />
    </div>
  )
}

function AddButton({
  children,
  onClick,
  emphasis = false,
}: {
  children: React.ReactNode
  onClick: () => void
  /** Gold (accent) border + bold weight. Used to highlight the
   *  Icon button per the spec. Purely visual — no behavior
   *  change. */
  emphasis?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-[7px] border-[1.5px] bg-white px-2 text-[12.5px] text-ink ${
        emphasis
          ? 'border-accent font-semibold hover:bg-accent/10'
          : 'border-hairline font-medium hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}

