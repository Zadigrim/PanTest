'use client'

import { type ComposerElement, newElementId } from '@/lib/design/stamp-composer/types'
import { DEFAULT_STAMP_FONT_KEY } from '@/lib/design/fonts'

/**
 * Add-element toolbar — sits above the canvas. Push 1 ships
 * the three shape buttons. Text / Curved text / Icon / Trace
 * land in upcoming pushes; the toolbar's slot pattern keeps
 * the button row a stable target.
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

  return (
    <div className="flex items-center gap-1.5 border-b border-hairline bg-white px-3 py-2">
      <p className="mr-2 text-[10px] font-semibold uppercase tracking-[2px] text-muted">Add</p>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'rect',
        x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 0,
        strokeWidth: 3,
      })}>
        ▭ <span className="ml-1">Rectangle</span>
      </AddButton>

      <AddButton onClick={() => onAdd({
        id: newElementId(), type: 'rect',
        x: cx - 50, y: cy - 30, w: 100, h: 60, rx: 12,
        strokeWidth: 3,
      })}>
        ▢ <span className="ml-1">Rounded rect</span>
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
        text: 'RIM TEXT',
        cx, cy,
        rx: 95, ry: 95,
        arc: 'top',
        fontSize: 18,
        fontFamily: DEFAULT_STAMP_FONT_KEY,
        bold: true,
        uppercase: true,
        letterSpacing: 2,
      })}>
        ⌒ <span className="ml-1">Curved text</span>
      </AddButton>

      {/* Push 3+ — these stubs render disabled so the affordance
          is discoverable when each one ships. */}
      <DisabledButton title="Push 3 — lucide icon picker">★ Icon</DisabledButton>
      <DisabledButton title="Push 4 — potrace tracer">⬚ Trace image</DisabledButton>
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
