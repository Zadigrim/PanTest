'use client'

import { useState } from 'react'
import { usePassportStore } from '@/lib/design/passport-store'
import type { CoverSideData } from '@/lib/design/types'

// ── Dimensions ────────────────────────────────────────────────────────────────
export const COVER_W  = 280   // px per panel
export const COVER_H  = 392   // px per panel
export const CANVAS_W = COVER_W * 2  // full canvas — no structural spine gap

export type CoverFace  = 'outside' | 'inside'
export type CoverPanel = 'front' | 'back'

const DEFAULTS: CoverSideData = {
  front_bg:      '0D1B2A',
  back_bg:       '0D1B2A',
  image_url:     null,
  image_opacity: 80,
}

export function getSideData(data: CoverSideData | null | undefined): CoverSideData {
  return { ...DEFAULTS, ...(data ?? {}) }
}

// ── CoverCanvas ───────────────────────────────────────────────────────────────

interface Props {
  face: CoverFace
  onFaceChange: (f: CoverFace) => void
  selectedPanel: CoverPanel
  onPanelChange: (p: CoverPanel) => void
}

export function CoverCanvas({ face, onFaceChange, selectedPanel, onPanelChange }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const [zoom, setZoom] = useState(0.85)

  if (!passport) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panoply-gray-1">
        <p className="text-sm text-panoply-gray-3">Loading…</p>
      </div>
    )
  }

  const raw = face === 'outside' ? passport.cover_outside_data : passport.cover_inside_data
  const side = getSideData(raw)

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    onPanelChange(x < COVER_W ? 'back' : 'front')
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-panoply-gray-1">
      {/* Face toggle */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-b border-panoply-gray-2 bg-white py-2">
        {(['outside', 'inside'] as CoverFace[]).map((f) => (
          <button
            key={f}
            onClick={() => onFaceChange(f)}
            className={`rounded-card px-3 py-1 text-sm font-medium capitalize transition-colors ${
              face === f
                ? 'bg-panoply-teal text-white'
                : 'text-panoply-gray-3 hover:text-panoply-navy'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-3 text-xs text-panoply-gray-3">
          Click a half to select it
        </span>
      </div>

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {/* Outer wrapper handles zoom via transform */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            width: CANVAS_W,
            height: COVER_H,
            flexShrink: 0,
          }}
        >
          {/* Single continuous surface */}
          <div
            role="img"
            aria-label="Cover canvas"
            className="relative cursor-pointer overflow-hidden shadow-xl"
            style={{ width: CANVAS_W, height: COVER_H }}
            onClick={handleCanvasClick}
          >
            {/* Back half solid bg */}
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: COVER_W, backgroundColor: `#${side.back_bg}` }}
            />

            {/* Front half solid bg */}
            <div
              className="absolute inset-y-0 right-0"
              style={{ width: COVER_W, backgroundColor: `#${side.front_bg}` }}
            />

            {/* Full-bleed image spanning both panels */}
            {side.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={side.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                style={{ opacity: side.image_opacity / 100 }}
                draggable={false}
              />
            )}

            {/* Front panel overlays: emblem + title (right half only) */}
            <div
              className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none"
              style={{ width: COVER_W }}
            >
              <span className="text-5xl drop-shadow" aria-hidden="true">
                {passport.cover_emblem || '🧭'}
              </span>
              <p
                className="px-6 text-center text-sm font-semibold leading-snug"
                style={{ color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
              >
                {passport.title || 'Untitled Passport'}
              </p>
            </div>

            {/* Spine fold line — 1px dashed, centered, no gutter */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: COVER_W,
                width: 0,
                borderLeft: '1px dashed rgba(255,255,255,0.35)',
                zIndex: 10,
              }}
            >
              <span
                className="absolute top-2 left-1 text-[9px] select-none"
                style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}
              >
                Spine
              </span>
            </div>

            {/* Selection ring — back half */}
            {selectedPanel === 'back' && (
              <div
                className="absolute inset-y-0 left-0 ring-2 ring-inset ring-panoply-teal pointer-events-none"
                style={{ width: COVER_W }}
              />
            )}

            {/* Selection ring — front half */}
            {selectedPanel === 'front' && (
              <div
                className="absolute inset-y-0 right-0 ring-2 ring-inset ring-panoply-teal pointer-events-none"
                style={{ width: COVER_W }}
              />
            )}

            {/* Panel labels */}
            <div className="absolute bottom-2 left-0 flex justify-center pointer-events-none" style={{ width: COVER_W }}>
              <span className="rounded-card bg-black/40 px-2 py-0.5 text-[10px] text-white/60">Back</span>
            </div>
            <div className="absolute bottom-2 right-0 flex justify-center pointer-events-none" style={{ width: COVER_W }}>
              <span className="rounded-card bg-black/40 px-2 py-0.5 text-[10px] text-white/60">Front</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-card border border-panoply-gray-2 bg-white px-2 py-1 shadow-sm">
        <button
          className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={() => setZoom((z) => Math.max(0.3, parseFloat((z - 0.1).toFixed(1))))}
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-xs text-panoply-gray-3">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={() => setZoom((z) => Math.min(2, parseFloat((z + 0.1).toFixed(1))))}
        >
          +
        </button>
        <button
          className="ml-1 border-l border-panoply-gray-2 pl-2 text-xs text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          onClick={() => setZoom(0.85)}
        >
          Reset
        </button>
      </div>
    </main>
  )
}
