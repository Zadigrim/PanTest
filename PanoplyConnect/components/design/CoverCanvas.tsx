'use client'

import { useState } from 'react'
import { usePassportStore } from '@/lib/design/passport-store'
import type { CoverHalf, CoverSideData } from '@/lib/design/types'

// ── Dimensions ────────────────────────────────────────────────────────────────
export const COVER_W = 280    // px per panel
export const COVER_H = 392    // px per panel
export const SPINE_W = 28     // px

export type CoverFace = 'outside' | 'inside'
export type CoverPanel = 'front' | 'back'

const DEFAULTS: CoverHalf = {
  bg_color: '0D1B2A',
  image_url: null,
  image_opacity: 80,
}

function getHalf(data: CoverSideData | null | undefined, panel: CoverPanel): CoverHalf {
  return data?.[panel] ?? DEFAULTS
}

// ── Single panel ──────────────────────────────────────────────────────────────

function CoverPanel({
  half,
  isSelected,
  isFront,
  emblem,
  title,
  onClick,
}: {
  half: CoverHalf
  isSelected: boolean
  isFront: boolean
  emblem: string
  title: string
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isFront ? 'Front cover' : 'Back cover'}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="relative shrink-0 cursor-pointer overflow-hidden"
      style={{ width: COVER_W, height: COVER_H }}
    >
      {/* Solid background */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `#${half.bg_color}` }}
      />

      {/* Full-bleed image */}
      {half.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={half.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: half.image_opacity / 100 }}
          draggable={false}
        />
      )}

      {/* Front-cover overlays: emblem + title */}
      {isFront && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none">
          <span className="text-5xl drop-shadow">{emblem || '🧭'}</span>
          <p
            className="px-4 text-center text-sm font-semibold leading-snug drop-shadow"
            style={{ color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
          >
            {title || 'Untitled Passport'}
          </p>
        </div>
      )}

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none ring-2 ring-inset ring-panoply-teal" />
      )}

      {/* Panel label */}
      <div
        className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none"
      >
        <span className="rounded-card bg-black/40 px-2 py-0.5 text-[10px] text-white/70">
          {isFront ? 'Front' : 'Back'}
        </span>
      </div>
    </div>
  )
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
  const [zoom, setZoom] = useState(0.9)

  if (!passport) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panoply-gray-1">
        <p className="text-sm text-panoply-gray-3">Loading…</p>
      </div>
    )
  }

  const sideData = face === 'outside' ? passport.cover_outside_data : passport.cover_inside_data
  const frontHalf = getHalf(sideData, 'front')
  const backHalf = getHalf(sideData, 'back')

  const totalW = (COVER_W * 2 + SPINE_W) * zoom
  const totalH = COVER_H * zoom

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-panoply-gray-1">
      {/* Face toggle */}
      <div className="flex items-center justify-center gap-1 border-b border-panoply-gray-2 bg-white py-2">
        {(['outside', 'inside'] as CoverFace[]).map((f) => (
          <button
            key={f}
            onClick={() => onFaceChange(f)}
            className={`rounded-card px-3 py-1 text-sm font-medium transition-colors capitalize ${
              face === f
                ? 'bg-panoply-teal text-white'
                : 'text-panoply-gray-3 hover:text-panoply-navy'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-3 text-xs text-panoply-gray-3">Click a panel to edit it</span>
      </div>

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div
          className="shrink-0 shadow-xl"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            width: COVER_W * 2 + SPINE_W,
            height: COVER_H,
          }}
        >
          {/* Back panel */}
          <CoverPanel
            half={backHalf}
            isSelected={selectedPanel === 'back'}
            isFront={false}
            emblem={passport.cover_emblem ?? '🧭'}
            title={passport.title}
            onClick={() => onPanelChange('back')}
          />

          {/* Spine */}
          <div
            className="relative shrink-0 flex items-center justify-center"
            style={{
              width: SPINE_W,
              backgroundColor: `#${frontHalf.bg_color}`,
              borderLeft: '1px dashed rgba(255,255,255,0.3)',
              borderRight: '1px dashed rgba(255,255,255,0.3)',
            }}
          >
            <span
              className="text-[9px] text-white/40 tracking-widest select-none"
              style={{ writingMode: 'vertical-rl' }}
            >
              fold
            </span>
          </div>

          {/* Front panel */}
          <CoverPanel
            half={frontHalf}
            isSelected={selectedPanel === 'front'}
            isFront
            emblem={passport.cover_emblem ?? '🧭'}
            title={passport.title}
            onClick={() => onPanelChange('front')}
          />
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
          onClick={() => setZoom(0.9)}
        >
          Reset
        </button>
      </div>
    </main>
  )
}
