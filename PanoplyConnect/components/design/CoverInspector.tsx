'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import type { CoverFace, CoverPanel } from './CoverCanvas'
import type { CoverHalf, CoverSideData } from '@/lib/design/types'

const DEFAULTS: CoverHalf = {
  bg_color: '0D1B2A',
  image_url: null,
  image_opacity: 80,
}

function mergeHalf(data: CoverSideData | null | undefined, panel: CoverPanel): CoverHalf {
  return { ...DEFAULTS, ...(data?.[panel] ?? {}) }
}

function buildSideData(
  existing: CoverSideData | null | undefined,
  panel: CoverPanel,
  patch: Partial<CoverHalf>,
): CoverSideData {
  const current: CoverSideData = existing ?? {
    front: { ...DEFAULTS },
    back: { ...DEFAULTS },
  }
  return {
    ...current,
    [panel]: { ...mergeHalf(existing, panel), ...patch },
  }
}

// ── CoverInspector ────────────────────────────────────────────────────────────

interface Props {
  face: CoverFace
  panel: CoverPanel
}

export function CoverInspector({ face, panel }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, startUpload] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)

  if (!passport) return null

  const sideKey = face === 'outside' ? 'cover_outside_data' : 'cover_inside_data'
  const sideData = passport[sideKey]
  const half = mergeHalf(sideData, panel)
  const isFront = panel === 'front'

  const persist = async (patch: Partial<CoverHalf>) => {
    const next = buildSideData(sideData, panel, patch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: next } as any)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('passports').update({ [sideKey]: next }).eq('id', passport.id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persistPassport = async (patch: Record<string, unknown>) => {
    updatePassport(patch as Parameters<typeof updatePassport>[0])
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('passports').update(patch).eq('id', passport.id)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    startUpload(async () => {
      const form = new FormData()
      form.append('file', file)
      form.append('asset_type', 'cover')
      form.append('name', file.name.replace(/\.[^.]+$/, ''))

      try {
        const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error ?? 'Upload failed')
        }
        const json = (await res.json()) as { url: string }
        await persist({ image_url: json.url })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        if (fileRef.current) fileRef.current.value = ''
      }
    })
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-panoply-gray-2 bg-white">
      <div className="border-b border-panoply-gray-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
          {face === 'outside' ? 'Outside' : 'Inside'} — {panel === 'front' ? 'Front' : 'Back'}
        </p>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Background color */}
        <div className="space-y-1.5">
          <Label className="text-xs text-panoply-gray-3">Background color</Label>
          <div className="flex gap-2">
            <Input
              value={half.bg_color}
              maxLength={6}
              onChange={(e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updatePassport({ [sideKey]: buildSideData(sideData, panel, { bg_color: e.target.value }) } as any)
              }}
              onBlur={(e) => persist({ bg_color: e.target.value })}
              className="h-8 flex-1 font-mono text-sm uppercase"
              placeholder="0D1B2A"
            />
            <div
              className="h-8 w-8 shrink-0 rounded-card border border-panoply-gray-2 cursor-pointer"
              style={{ backgroundColor: `#${half.bg_color}` }}
            />
          </div>
        </div>

        {/* Full-bleed image */}
        <div className="space-y-2">
          <Label className="text-xs text-panoply-gray-3">Full-bleed image</Label>

          {half.image_url ? (
            <div className="relative overflow-hidden rounded-card border border-panoply-gray-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={half.image_url}
                alt="Cover image"
                className="h-28 w-full object-cover"
                style={{ opacity: half.image_opacity / 100 }}
              />
              <button
                onClick={() => persist({ image_url: null })}
                className="absolute right-1.5 top-1.5 rounded-card bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-20 w-full items-center justify-center rounded-card border-2 border-dashed border-panoply-gray-2 text-sm text-panoply-gray-3 hover:border-panoply-teal hover:text-panoply-teal-dk transition-colors disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : '+ Upload image'}
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleImageUpload}
            tabIndex={-1}
            aria-hidden="true"
          />

          {uploadError && (
            <p className="text-xs text-panoply-coral">{uploadError}</p>
          )}

          {/* Opacity slider — only shown when image is set */}
          {half.image_url && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-panoply-gray-3">Opacity</Label>
                <span className="text-xs font-mono text-panoply-navy">{half.image_opacity}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={half.image_opacity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  updatePassport({ [sideKey]: buildSideData(sideData, panel, { image_opacity: v }) } as any)
                }}
                onMouseUp={(e) => persist({ image_opacity: parseInt((e.target as HTMLInputElement).value, 10) })}
                onTouchEnd={(e) => persist({ image_opacity: parseInt((e.target as HTMLInputElement).value, 10) })}
                className="h-1.5 w-full cursor-pointer accent-panoply-teal"
              />
              <div className="flex justify-between text-[10px] text-panoply-gray-3">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </div>

        {/* Front-cover only: emblem + title */}
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
              <p className="text-[10px] text-panoply-gray-3">
                Title appears on the front cover and in the stop library.
              </p>
            </div>
          </>
        )}

        {/* Tip */}
        <p className="rounded-card bg-panoply-gray-1 px-3 py-2.5 text-xs text-panoply-gray-3 leading-relaxed">
          Click the other panel on the canvas to edit {panel === 'front' ? 'the back cover' : 'the front cover'}.
        </p>
      </div>
    </aside>
  )
}
