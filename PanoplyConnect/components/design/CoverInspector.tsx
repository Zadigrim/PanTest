'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { getSideData, CANVAS_W, COVER_H } from './CoverCanvas'
import type { CoverFace, CoverPanel } from './CoverCanvas'
import { ColorPickerInput } from './ui/ColorPickerInput'
import type { CoverSideData } from '@/lib/design/types'

// ── CoverInspector ────────────────────────────────────────────────────────────

interface Props {
  face: CoverFace
  panel: CoverPanel
}

export function CoverInspector({ face, panel }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)
  const selectedElementId = usePassportStore((s) => s.selectedElementId)
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [uploading, startUpload] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!passport) return null

  const sideKey = face === 'outside' ? 'cover_outside_data' : 'cover_inside_data'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sideData = getSideData((passport as any)[sideKey])
  const isFront = panel === 'front'
  const bgKey: keyof CoverSideData = isFront ? 'front_bg' : 'back_bg'

  const selectedElement = selectedElementId
    ? (sideData.elements ?? []).find((el) => el.id === selectedElementId) ?? null
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persist = async (patch: Partial<CoverSideData>) => {
    const next: CoverSideData = { ...sideData, ...patch }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: next } as any)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('passports').update({ [sideKey]: next }).eq('id', passport.id)
  }

  const persistElement = async (elementId: string, patch: Partial<import('@/lib/design/types').DesignerPageElement>) => {
    const next = (sideData.elements ?? []).map((el) =>
      el.id === elementId ? { ...el, ...patch } : el
    )
    await persist({ elements: next })
  }

  const updateElementLocal = (elementId: string, patch: Partial<import('@/lib/design/types').DesignerPageElement>) => {
    const next = (sideData.elements ?? []).map((el) =>
      el.id === elementId ? { ...el, ...patch } : el
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: { ...sideData, elements: next } } as any)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persistPassport = async (patch: Record<string, unknown>) => {
    updatePassport(patch as Parameters<typeof updatePassport>[0])
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('passports').update(patch).eq('id', passport.id)
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData()
    form.append('file', file)
    form.append('asset_type', 'cover')
    form.append('name', file.name.replace(/\.[^.]+$/, ''))
    const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      throw new Error(json.error ?? 'Upload failed')
    }
    const json = (await res.json()) as { url: string }
    return json.url
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    startUpload(async () => {
      try {
        const url = await uploadImage(file)
        if (url) await persist({ image_url: url })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        if (e.target) e.target.value = ''
      }
    })
  }

  function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    startUpload(async () => {
      try {
        const url = await uploadImage(file)
        if (url) await persist({ image_url: url })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        if (e.target) e.target.value = ''
      }
    })
  }

  async function handleRemoveConfirmed() {
    await persist({ image_url: null })
    setConfirmRemove(false)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-panoply-gray-2 bg-white">
      <div className="border-b border-panoply-gray-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
          {face === 'outside' ? 'Outside' : 'Inside'} cover —{' '}
          {panel === 'front' ? 'Front panel' : 'Back panel'}
        </p>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Selected text element controls */}
        {selectedElement && selectedElement.type === 'text' && (
          <div className="space-y-3 rounded-card border border-panoply-teal/30 bg-panoply-teal-lt p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-panoply-teal-dk">
              Text element
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-panoply-gray-3">Content</Label>
              <textarea
                value={selectedElement.content ?? ''}
                placeholder="Cover text…"
                rows={3}
                onChange={(e) =>
                  updateElementLocal(selectedElement.id, { content: e.target.value })
                }
                onBlur={(e) => void persistElement(selectedElement.id, { content: e.target.value })}
                className="w-full resize-y rounded-panel border border-panoply-gray-2 bg-white px-3 py-1.5 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-panoply-gray-3">Size (px)</Label>
                <Input
                  type="number"
                  min={8}
                  max={72}
                  value={selectedElement.fontSize ?? 14}
                  onChange={(e) =>
                    updateElementLocal(selectedElement.id, { fontSize: Number(e.target.value) })
                  }
                  onBlur={(e) => void persistElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-panoply-gray-3">Weight</Label>
                <select
                  value={selectedElement.fontWeight ?? 'normal'}
                  onChange={(e) =>
                    void persistElement(selectedElement.id, {
                      fontWeight: e.target.value as 'normal' | 'bold',
                    })
                  }
                  className="h-8 w-full rounded-panel border border-panoply-gray-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-panoply-teal"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-panoply-gray-3">Align</Label>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => void persistElement(selectedElement.id, { align: a })}
                    className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                      (selectedElement.align ?? 'left') === a
                        ? 'border-panoply-teal bg-panoply-teal text-white font-medium'
                        : 'border-panoply-gray-2 text-panoply-gray-3 hover:border-panoply-teal/40'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Background color for selected panel */}
        <div className="space-y-1.5">
          <Label className="text-xs text-panoply-gray-3">
            {isFront ? 'Front' : 'Back'} background color
          </Label>
          <div className="flex gap-2">
            <Input
              value={sideData[bgKey]}
              maxLength={6}
              onChange={(e) => {
                const next = { ...sideData, [bgKey]: e.target.value }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updatePassport({ [sideKey]: next } as any)
              }}
              onBlur={(e) => persist({ [bgKey]: e.target.value })}
              className="h-8 flex-1 font-mono text-sm uppercase"
              placeholder="0D1B2A"
            />
            <ColorPickerInput
              value={sideData[bgKey]}
              onChange={(hex) => {
                const next = { ...sideData, [bgKey]: hex }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updatePassport({ [sideKey]: next } as any)
              }}
              onCommit={(hex) => void persist({ [bgKey]: hex })}
            />
          </div>
        </div>

        {/* Full-bleed image (spans both panels) */}
        <div className="space-y-2">
          <Label className="text-xs text-panoply-gray-3">Full-bleed image (both panels)</Label>

          {sideData.image_url ? (
            <>
              {/* Preview */}
              <div className="relative overflow-hidden rounded-card border border-panoply-gray-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sideData.image_url}
                  alt="Cover image preview"
                  className="h-24 w-full object-cover"
                  style={{ opacity: sideData.image_opacity / 100 }}
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-panoply-gray-3">Opacity</Label>
                  <span className="font-mono text-xs text-panoply-navy">{sideData.image_opacity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={sideData.image_opacity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    updatePassport({ [sideKey]: { ...sideData, image_opacity: v } } as any)
                  }}
                  onMouseUp={(e) => persist({ image_opacity: parseInt((e.target as HTMLInputElement).value, 10) })}
                  onTouchEnd={(e) => persist({ image_opacity: parseInt((e.target as HTMLInputElement).value, 10) })}
                  className="h-1.5 w-full cursor-pointer accent-panoply-teal"
                />
                <div className="flex justify-between text-[10px] text-panoply-gray-3">
                  <span>10%</span><span>100%</span>
                </div>
              </div>

              {/* Position + scale */}
              <div className="space-y-2 rounded-card border border-panoply-gray-2 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-panoply-gray-3">
                  Position &amp; scale
                </p>

                {/* X / Y offset */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-panoply-gray-3">X offset (px)</label>
                    <input
                      type="number"
                      value={Math.round((sideData.image_position_x - 0.5) * CANVAS_W)}
                      min={-Math.round(CANVAS_W / 2)}
                      max={Math.round(CANVAS_W / 2)}
                      step={1}
                      onChange={(e) => {
                        const px = 0.5 + parseInt(e.target.value || '0', 10) / CANVAS_W
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        updatePassport({ [sideKey]: { ...sideData, image_position_x: Math.max(0, Math.min(1, px)) } } as any)
                      }}
                      onBlur={(e) => {
                        const px = 0.5 + parseInt(e.target.value || '0', 10) / CANVAS_W
                        void persist({ image_position_x: Math.max(0, Math.min(1, px)) })
                      }}
                      className="h-7 w-full rounded-card border border-panoply-gray-2 px-2 font-mono text-xs text-panoply-navy focus:border-panoply-teal focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-panoply-gray-3">Y offset (px)</label>
                    <input
                      type="number"
                      value={Math.round((sideData.image_position_y - 0.5) * COVER_H)}
                      min={-Math.round(COVER_H / 2)}
                      max={Math.round(COVER_H / 2)}
                      step={1}
                      onChange={(e) => {
                        const py = 0.5 + parseInt(e.target.value || '0', 10) / COVER_H
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        updatePassport({ [sideKey]: { ...sideData, image_position_y: Math.max(0, Math.min(1, py)) } } as any)
                      }}
                      onBlur={(e) => {
                        const py = 0.5 + parseInt(e.target.value || '0', 10) / COVER_H
                        void persist({ image_position_y: Math.max(0, Math.min(1, py)) })
                      }}
                      className="h-7 w-full rounded-card border border-panoply-gray-2 px-2 font-mono text-xs text-panoply-navy focus:border-panoply-teal focus:outline-none"
                    />
                  </div>
                </div>

                {/* Scale slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-panoply-gray-3">Scale</label>
                    <span className="font-mono text-xs text-panoply-navy">
                      {Math.round(sideData.image_scale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={300}
                    step={5}
                    value={Math.round(sideData.image_scale * 100)}
                    onChange={(e) => {
                      const scale = parseInt(e.target.value, 10) / 100
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      updatePassport({ [sideKey]: { ...sideData, image_scale: scale } } as any)
                    }}
                    onMouseUp={(e) => {
                      const scale = parseInt((e.target as HTMLInputElement).value, 10) / 100
                      void persist({ image_scale: scale })
                    }}
                    onTouchEnd={(e) => {
                      const scale = parseInt((e.target as HTMLInputElement).value, 10) / 100
                      void persist({ image_scale: scale })
                    }}
                    className="h-1.5 w-full cursor-pointer accent-panoply-teal"
                  />
                  <div className="flex justify-between text-[10px] text-panoply-gray-3">
                    <span>100%</span><span>300%</span>
                  </div>
                </div>

                {/* Quick-action presets */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void persist({ image_position_x: 0.5, image_position_y: 0.5, image_scale: 1 })}
                    className="flex-1 h-7 rounded-card border border-panoply-gray-2 text-[10px] text-panoply-gray-3 hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors"
                  >
                    Fit width
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const heightScale = CANVAS_W / COVER_H
                      void persist({ image_position_x: 0.5, image_position_y: 0.5, image_scale: Math.max(1, heightScale) })
                    }}
                    className="flex-1 h-7 rounded-card border border-panoply-gray-2 text-[10px] text-panoply-gray-3 hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors"
                  >
                    Fit height
                  </button>
                  <button
                    type="button"
                    onClick={() => void persist({ image_position_x: 0.5, image_position_y: 0.5, image_scale: 1.5 })}
                    className="flex-1 h-7 rounded-card border border-panoply-gray-2 text-[10px] text-panoply-gray-3 hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors"
                  >
                    Fill canvas
                  </button>
                </div>
              </div>

              {/* Remove / Replace buttons */}
              {confirmRemove ? (
                <div className="rounded-card border border-panoply-coral/40 bg-panoply-coral/5 p-3 space-y-2">
                  <p className="text-xs text-panoply-coral">Remove this cover image? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRemoveConfirmed}
                      className="flex-1 h-7 rounded-card bg-panoply-coral text-white text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setConfirmRemove(false)}
                      className="flex-1 h-7 rounded-card border border-panoply-gray-2 text-xs text-panoply-gray-3 hover:text-panoply-navy transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRemove(true)}
                    className="flex-1 h-8 rounded-card border border-panoply-gray-2 text-xs text-panoply-gray-3 hover:border-panoply-coral hover:text-panoply-coral transition-colors"
                  >
                    Remove image
                  </button>
                  <button
                    onClick={() => replaceRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-8 rounded-card border border-panoply-gray-2 text-xs text-panoply-navy hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors disabled:opacity-60"
                  >
                    {uploading ? 'Uploading…' : 'Replace image'}
                  </button>
                </div>
              )}
              <input
                ref={replaceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleReplace}
                tabIndex={-1}
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-20 w-full items-center justify-center rounded-card border-2 border-dashed border-panoply-gray-2 text-sm text-panoply-gray-3 hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : '+ Upload cover image'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageUpload}
                tabIndex={-1}
                aria-hidden="true"
              />
            </>
          )}

          {uploadError && (
            <p className="text-xs text-panoply-coral">{uploadError}</p>
          )}
        </div>

        {/* Front-only: emblem + title */}
        {isFront && face === 'outside' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-panoply-gray-3">Emblem (emoji)</Label>
              <Input
                value={passport.cover_emblem ?? '🧭'}
                maxLength={4}
                onChange={(e) => updatePassport({ cover_emblem: e.target.value })}
                onBlur={(e) => persistPassport({ cover_emblem: e.target.value })}
                className="h-8 text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-panoply-gray-3">Passport title</Label>
              <Input
                value={passport.title}
                onChange={(e) => updatePassport({ title: e.target.value })}
                onBlur={(e) => persistPassport({ title: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </>
        )}

        <p className="rounded-card bg-panoply-gray-1 px-3 py-2.5 text-xs text-panoply-gray-3 leading-relaxed">
          The image spans both front and back panels. Click the{' '}
          {panel === 'front' ? 'back' : 'front'} panel on the canvas to edit its background color.
        </p>
      </div>
    </aside>
  )
}
