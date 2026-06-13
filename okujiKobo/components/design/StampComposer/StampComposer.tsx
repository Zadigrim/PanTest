'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_SURFACE_SIZE, emptyComposerDoc, type ComposerElement, type ComposerMetadata } from '@/lib/design/stamp-composer/types'
import { serializeStampSvg } from '@/lib/design/stamp-composer/svg'
import { hasDateToken } from '@/lib/design/stamp-composer/date-token'
import { BLANK_PRESET, PRESETS } from '@/lib/design/stamp-composer/presets'
import { ComposerCanvas } from './ComposerCanvas'
import { ComposerInspector } from './ComposerInspector'
import { ComposerElementList } from './ComposerElementList'
import { ComposerAddToolbar } from './ComposerAddToolbar'
import { saveComposedStamp } from './save'

/**
 * Stamp Composer modal.
 *
 * Two launch points (StampPicker · Assets stamps tab) mount the
 * same modal with different `mode` props. Either way the modal:
 *   - opens with a preset chooser (or restored metadata from
 *     an Edit-in-composer entry)
 *   - lets the user add / drag / resize / rotate / delete /
 *     duplicate / reorder elements
 *   - saves to design_assets as asset_type='stamp', honoring
 *     the existing scoping rule:
 *       * designer launch → scoped to currentPassportId by default;
 *         "Also save to my general library" checkbox promotes
 *         to library-wide.
 *       * assets-tab launch → always library-wide; no checkbox.
 *   - returns the saved asset { id, url } via onSaved so the
 *     launcher can refresh its picker.
 */
interface CommonProps {
  open: boolean
  onClose: () => void
  /** Resume editing — load existing metadata into the canvas. */
  initialDoc?: ComposerMetadata | null
  /** Pre-fill display name from an existing asset when editing. */
  initialName?: string
  /** parent_asset_id to thread when saving a NEW version of an
   *  existing composed stamp. Null = root version. */
  parentAssetId?: string | null
  onSaved: (asset: { id: string; url: string }) => void
}

interface DesignerMode extends CommonProps {
  mode: 'designer'
  currentPassportId: string
}
interface AssetsMode extends CommonProps {
  mode: 'assets'
  currentPassportId?: undefined
}

export function StampComposer(props: DesignerMode | AssetsMode) {
  const { open, onClose, initialDoc, initialName, parentAssetId = null, onSaved } = props

  // ── Document state ──
  const [doc, setDoc] = useState<ComposerMetadata>(() => initialDoc ?? emptyComposerDoc())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState<string>(initialName ?? '')
  const [pickedPreset, setPickedPreset] = useState<boolean>(!!initialDoc)
  // Designer mode lets the admin opt-in to library-wide save;
  // unchecked = scoped to current passport. Assets mode = always
  // library-wide, no checkbox.
  const [saveToLibrary, setSaveToLibrary] = useState<boolean>(props.mode === 'assets')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when (re)opened with different initial input.
  useEffect(() => {
    if (open) {
      setDoc(initialDoc ?? emptyComposerDoc())
      setSelectedId(null)
      setName(initialName ?? '')
      setPickedPreset(!!initialDoc)
      setSaveToLibrary(props.mode === 'assets')
      setError(null)
    }
  }, [open, initialDoc, initialName, props.mode])

  const updateElement = useCallback((id: string, patch: Partial<ComposerElement>) => {
    setDoc((d) => ({
      ...d,
      elements: d.elements.map((el) => el.id === id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ({ ...el, ...patch } as any)
        : el),
    }))
  }, [])

  const addElement = useCallback((el: ComposerElement) => {
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }))
    setSelectedId(el.id)
  }, [])

  const deleteElement = useCallback((id: string) => {
    setDoc((d) => ({ ...d, elements: d.elements.filter((el) => el.id !== id) }))
    setSelectedId((sid) => sid === id ? null : sid)
  }, [])

  const duplicateElement = useCallback((id: string) => {
    setDoc((d) => {
      const idx = d.elements.findIndex((e) => e.id === id)
      if (idx < 0) return d
      const src = d.elements[idx]
      const clone = { ...src, id: 'el_' + Math.random().toString(36).slice(2, 10) } as ComposerElement
      // Bump the visible offset slightly so the duplicate
      // doesn't sit exactly under the original.
      const bumped = nudge(clone, 8)
      return { ...d, elements: [...d.elements.slice(0, idx + 1), bumped, ...d.elements.slice(idx + 1)] }
    })
  }, [])

  const reorderElement = useCallback((id: string, direction: 'up' | 'down') => {
    setDoc((d) => {
      const idx = d.elements.findIndex((e) => e.id === id)
      if (idx < 0) return d
      const next = direction === 'up' ? idx + 1 : idx - 1
      if (next < 0 || next >= d.elements.length) return d
      const arr = d.elements.slice()
      const [picked] = arr.splice(idx, 1)
      arr.splice(next, 0, picked)
      return { ...d, elements: arr }
    })
  }, [])

  const selected = useMemo(
    () => doc.elements.find((e) => e.id === selectedId) ?? null,
    [doc.elements, selectedId],
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const svg = serializeStampSvg(doc)
      const saved = await saveComposedStamp({
        svg,
        metadata: doc,
        name: name.trim() || 'Composed stamp',
        parentAssetId,
        scopedPassportId:
          props.mode === 'designer' && !saveToLibrary ? props.currentPassportId : null,
      })
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [doc, name, parentAssetId, props, saveToLibrary, onSaved, onClose])

  if (!open) return null

  // Portal so the modal escapes the StampPicker / Assets layout
  // and floats over everything else.
  const root = typeof document !== 'undefined' ? document.body : null
  if (!root) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[min(960px,98vh)] w-[min(1320px,98vw)] flex-col overflow-hidden rounded-[12px] border-[1.5px] border-ink bg-white shadow-2xl">
        {/* ── Header — chrome strip, 1.5px ink bottom border ── */}
        <div className="flex h-[54px] items-center gap-3 border-b-[1.5px] border-ink bg-surface-chrome px-5">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-muted">Stamp composer</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled stamp"
            className="flex-1 rounded-[8px] border-[1.5px] border-hairline bg-white px-2.5 py-1.5 text-[14px] text-ink focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border-[1.5px] border-ink bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-cream"
          >
            Cancel
          </button>
          {props.mode === 'designer' && (
            <label
              className="flex items-center gap-1.5 text-[12.5px] text-muted"
              title="Unchecked: this stamp is only available on the current passport. Checked: this stamp also shows up in the StampPicker on every other passport you own and in the Assets → Stamps library."
            >
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-green"
              />
              Use on other passports
            </label>
          )}
          <button
            type="button"
            disabled={saving || doc.elements.length === 0}
            onClick={() => void handleSave()}
            className="rounded-[8px] border-[1.5px] border-ink bg-green px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save stamp'}
          </button>
        </div>

        {error && (
          <p role="alert" className="border-b border-red/30 bg-red/5 px-5 py-2 text-[12px] text-red">{error}</p>
        )}

        {/* Preset chooser shown before the canvas when no preset has been picked
            (and no initial doc was passed in to resume editing). */}
        {!pickedPreset ? (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="w-full max-w-2xl">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[2px] text-muted">
                Start from
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[BLANK_PRESET, ...PRESETS].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { setDoc(p.build()); setPickedPreset(true); }}
                    className="flex items-start gap-3 rounded-[10px] border-[1.5px] border-hairline bg-white px-3 py-3 text-left hover:border-ink/40"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface-workspace text-[10px] text-muted">
                      {p.key === 'blank' ? '—' : '◬'}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{p.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] text-muted">
                Pick one to start — every element is fully editable after. Or
                start blank.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* ── Left rail: element list ── */}
            <aside className="w-[210px] shrink-0 overflow-y-auto border-r-[1.5px] border-surface-faintdiv bg-cream">
              <ComposerElementList
                elements={doc.elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={reorderElement}
                onDuplicate={duplicateElement}
                onDelete={deleteElement}
              />
            </aside>

            {/* ── Center: add-toolbar above canvas ── */}
            <main className="flex flex-1 flex-col overflow-hidden">
              <ComposerAddToolbar onAdd={addElement} surface={STAMP_SURFACE_SIZE} />
              <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-rail p-6">
                <ComposerCanvas
                  doc={doc}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onUpdate={updateElement}
                />
              </div>
              {/* Dynamic-token indicator. Renders only when the doc
                  uses {{date}}, so it stays subtle on plain stamps
                  and surfaces clearly when there's something to
                  flag. Designer needs to see "this date is a
                  sample" so they don't mistake today's date for
                  a baked-in literal. */}
              {docHasDateToken(doc) && (
                <div className="border-t-[1.5px] border-hairline bg-surface-workspace px-4 py-1.5 text-center text-[10.5px] text-muted">
                  Preview shows today’s date as a sample —
                  each collector’s stamp will show their own earned date.
                </div>
              )}
            </main>

            {/* ── Right rail: inspector ── */}
            <aside className="w-[280px] shrink-0 overflow-y-auto border-l-[1.5px] border-ink bg-surface-workspace">
              <ComposerInspector
                element={selected}
                onUpdate={(patch) => selected && updateElement(selected.id, patch)}
                onDelete={() => selected && deleteElement(selected.id)}
                onDuplicate={() => selected && duplicateElement(selected.id)}
              />
            </aside>
          </div>
        )}
      </div>
    </div>,
    root,
  )
}

// True if any text / curvedText element in the doc carries the
// {{date}} token — gates the dynamic-indicator strip under the
// canvas.
function docHasDateToken(doc: ComposerMetadata): boolean {
  return doc.elements.some(
    (el) => (el.type === 'text' || el.type === 'curvedText') && hasDateToken(el.text),
  )
}

// Tiny helper: shift any element by (dx, dy) so a duplicate
// lands visibly offset from its source.
function nudge(el: ComposerElement, by: number): ComposerElement {
  switch (el.type) {
    case 'rect':       return { ...el, x: el.x + by, y: el.y + by }
    case 'polyshape':  return { ...el, x: el.x + by, y: el.y + by }
    case 'ellipse':    return { ...el, cx: el.cx + by, cy: el.cy + by }
    case 'line':       return { ...el, x1: el.x1 + by, y1: el.y1 + by, x2: el.x2 + by, y2: el.y2 + by }
    case 'triangle':   return {
      ...el,
      x1: el.x1 + by, y1: el.y1 + by,
      x2: el.x2 + by, y2: el.y2 + by,
      x3: el.x3 + by, y3: el.y3 + by,
    }
    case 'curvedText': return { ...el, cx: el.cx + by, cy: el.cy + by }
    case 'text':       return { ...el, x: el.x + by, y: el.y + by }
    case 'icon':       return { ...el, x: el.x + by, y: el.y + by }
    case 'traced':     return { ...el, x: el.x + by, y: el.y + by }
  }
}
