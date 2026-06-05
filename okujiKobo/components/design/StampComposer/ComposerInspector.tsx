'use client'

import type { ComposerElement } from '@/lib/design/stamp-composer/types'

/**
 * Right-rail inspector — element-type-aware controls.
 *
 * No color picker anywhere — the composer is monochrome by
 * design (re-inking happens per stop). Inspector covers
 * geometry + stroke + (per type) corner radius / line cap.
 */
export function ComposerInspector({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  element: ComposerElement | null
  onUpdate: (patch: Partial<ComposerElement>) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  if (!element) {
    return (
      <div className="px-3 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Inspector</p>
        <p className="mt-2 text-[11.5px] text-muted">
          Select an element to edit its geometry, stroke, and rotation.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-hairline px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Inspector</p>
        <p className="mt-1 text-[12.5px] font-semibold text-ink">{element.type}</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {/* Geometry differs per type; stroke + rotation are common. */}
        {element.type === 'rect'    && <RectGeometry    el={element} onUpdate={onUpdate} />}
        {element.type === 'ellipse' && <EllipseGeometry el={element} onUpdate={onUpdate} />}
        {element.type === 'line'    && <LineGeometry    el={element} onUpdate={onUpdate} />}

        {(element.type === 'rect' || element.type === 'ellipse' || element.type === 'line') && (
          <StrokeStyle el={element} onUpdate={onUpdate} />
        )}

        <RotationControl el={element} onUpdate={onUpdate} />

        <Section title="Actions">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="flex-1 rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-1 text-[11px] font-semibold text-muted hover:text-ink"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 rounded-[6px] border-[1.5px] border-red bg-white px-2 py-1 text-[11px] font-semibold text-red hover:bg-red hover:text-white"
            >
              Delete
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Per-type geometry blocks ────────────────────────────────────────────────

function RectGeometry({
  el,
  onUpdate,
}: {
  el: Extract<ComposerElement, { type: 'rect' }>
  onUpdate: (patch: Partial<ComposerElement>) => void
}) {
  return (
    <Section title="Geometry">
      <Grid2>
        <Num label="x" value={el.x}     onChange={(v) => onUpdate({ x: v })} />
        <Num label="y" value={el.y}     onChange={(v) => onUpdate({ y: v })} />
        <Num label="w" value={el.w} min={4} onChange={(v) => onUpdate({ w: v })} />
        <Num label="h" value={el.h} min={4} onChange={(v) => onUpdate({ h: v })} />
      </Grid2>
      <Num label="Corner radius" value={el.rx ?? 0} min={0} onChange={(v) => onUpdate({ rx: v })} />
    </Section>
  )
}

function EllipseGeometry({
  el,
  onUpdate,
}: {
  el: Extract<ComposerElement, { type: 'ellipse' }>
  onUpdate: (patch: Partial<ComposerElement>) => void
}) {
  return (
    <Section title="Geometry">
      <Grid2>
        <Num label="cx" value={el.cx} onChange={(v) => onUpdate({ cx: v })} />
        <Num label="cy" value={el.cy} onChange={(v) => onUpdate({ cy: v })} />
        <Num label="rx" value={el.rx} min={2} onChange={(v) => onUpdate({ rx: v })} />
        <Num label="ry" value={el.ry} min={2} onChange={(v) => onUpdate({ ry: v })} />
      </Grid2>
    </Section>
  )
}

function LineGeometry({
  el,
  onUpdate,
}: {
  el: Extract<ComposerElement, { type: 'line' }>
  onUpdate: (patch: Partial<ComposerElement>) => void
}) {
  return (
    <Section title="Geometry">
      <Grid2>
        <Num label="x1" value={el.x1} onChange={(v) => onUpdate({ x1: v })} />
        <Num label="y1" value={el.y1} onChange={(v) => onUpdate({ y1: v })} />
        <Num label="x2" value={el.x2} onChange={(v) => onUpdate({ x2: v })} />
        <Num label="y2" value={el.y2} onChange={(v) => onUpdate({ y2: v })} />
      </Grid2>
      <Field label="End caps">
        <select
          value={el.linecap ?? 'butt'}
          onChange={(e) => onUpdate({ linecap: e.target.value as 'butt' | 'round' | 'square' })}
          className="h-7 w-full rounded-[6px] border-[1.5px] border-hairline bg-white px-1.5 text-[12px] focus:border-ink focus:outline-none"
        >
          <option value="butt">Flat</option>
          <option value="round">Round</option>
          <option value="square">Square</option>
        </select>
      </Field>
    </Section>
  )
}

// ── Common: stroke + rotation ──

function StrokeStyle({
  el,
  onUpdate,
}: {
  el: Extract<ComposerElement, { type: 'rect' | 'ellipse' | 'line' }>
  onUpdate: (patch: Partial<ComposerElement>) => void
}) {
  return (
    <Section title="Stroke">
      <Num label="Width" value={el.strokeWidth} min={0.5} step={0.5}
           onChange={(v) => onUpdate({ strokeWidth: v })} />
      <Checkbox label="Dashed" checked={el.dashed === true}
                onChange={(v) => onUpdate({ dashed: v })} />
      {el.type !== 'line' && (
        <Checkbox label="Filled" checked={el.filled === true}
                  onChange={(v) => onUpdate({ filled: v })} />
      )}
    </Section>
  )
}

function RotationControl({
  el,
  onUpdate,
}: {
  el: ComposerElement
  onUpdate: (patch: Partial<ComposerElement>) => void
}) {
  return (
    <Section title="Rotation">
      <input
        type="range"
        min={-180} max={180} step={1}
        value={el.rotation ?? 0}
        onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
        className="w-full accent-green"
      />
      <p className="mt-1 text-[10.5px] text-muted">{(el.rotation ?? 0).toFixed(0)}°</p>
    </Section>
  )
}

// ── Field helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[10.5px] uppercase tracking-[1px] text-muted">
      {label}
      <div className="mt-0.5 normal-case tracking-normal">{children}</div>
    </label>
  )
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>
}
function Num({
  label, value, onChange, min, step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(v)
        }}
        className="h-7 w-full rounded-[6px] border-[1.5px] border-hairline bg-white px-1.5 text-[12px] tabular-nums focus:border-ink focus:outline-none"
      />
    </Field>
  )
}
function Checkbox({
  label, checked, onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded accent-green"
      />
      {label}
    </label>
  )
}
