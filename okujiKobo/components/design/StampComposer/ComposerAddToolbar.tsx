'use client'

import { useState } from 'react'
import { type ComposerElement, type PolyshapeKind, newElementId, STAMP_SURFACE_SIZE } from '@/lib/design/stamp-composer/types'
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

      <ShapeMenu cx={cx} cy={cy} onAdd={onAdd} />

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

// ── Shape dropdown — condenses the per-shape buttons into one menu ───────────

function polyshape(shape: PolyshapeKind, cx: number, cy: number): ComposerElement {
  return { id: newElementId(), type: 'polyshape', shape, x: cx - 50, y: cy - 50, w: 100, h: 100, strokeWidth: 3 }
}

const SHAPE_OPTIONS: Array<{ label: string; glyph: string; make: (cx: number, cy: number) => ComposerElement }> = [
  { label: 'Rectangle',    glyph: '▭', make: (cx, cy) => ({ id: newElementId(), type: 'rect', x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 0, strokeWidth: 3 }) },
  { label: 'Rounded rect', glyph: '▢', make: (cx, cy) => ({ id: newElementId(), type: 'rect', x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 12, strokeWidth: 3 }) },
  { label: 'Circle',       glyph: '◯', make: (cx, cy) => ({ id: newElementId(), type: 'ellipse', cx, cy, rx: 50, ry: 50, strokeWidth: 3 }) },
  { label: 'Ellipse',      glyph: '◯', make: (cx, cy) => ({ id: newElementId(), type: 'ellipse', cx, cy, rx: 60, ry: 35, strokeWidth: 3 }) },
  { label: 'Triangle',     glyph: '△', make: (cx, cy) => {
    const s = 100, h = (s * Math.sqrt(3)) / 2
    return { id: newElementId(), type: 'triangle', x1: cx, y1: cy - (h * 2) / 3, x2: cx - s / 2, y2: cy + h / 3, x3: cx + s / 2, y3: cy + h / 3, strokeWidth: 3 }
  } },
  { label: 'Line',         glyph: '─', make: (cx, cy) => ({ id: newElementId(), type: 'line', x1: cx - 50, y1: cy, x2: cx + 50, y2: cy, strokeWidth: 3 }) },
  { label: 'Star',         glyph: '★', make: (cx, cy) => polyshape('star', cx, cy) },
  { label: 'Diamond',      glyph: '◆', make: (cx, cy) => polyshape('diamond', cx, cy) },
  { label: 'Shield',       glyph: '❖', make: (cx, cy) => polyshape('shield', cx, cy) },
  { label: 'Pentagon',     glyph: '⬠', make: (cx, cy) => polyshape('pentagon', cx, cy) },
]

function ShapeMenu({ cx, cy, onAdd }: { cx: number; cy: number; onAdd: (el: ComposerElement) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <AddButton onClick={() => setOpen((v) => !v)}>
        ▭ <span className="ml-1">Shape ▾</span>
      </AddButton>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-[8px] border-[1.5px] border-hairline bg-white py-1 shadow-lg">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => { onAdd(opt.make(cx, cy)); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-ink hover:bg-cream"
              >
                <span className="w-4 text-center">{opt.glyph}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
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

