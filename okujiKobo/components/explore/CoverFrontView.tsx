'use client'

import type { DesignerPageElement } from '@/lib/design/types'
import { ReadOnlyElement } from './ReadOnlyElements'

// Cover canvas geometry — must match CoverCanvas.tsx so the
// coordinates the designer wrote land in the right places here.
const COVER_W  = 612
const COVER_H  = 792
const SPINE_W  = 24
const CANVAS_W = COVER_W * 2 + SPINE_W   // 1248
const FRONT_X  = COVER_W + SPINE_W       // 636 — left edge of the front panel within the canvas

export interface ViewerCover {
  front_bg: string | null
  back_bg:  string | null
  image_url: string | null
  image_opacity: number
  image_position_x: number
  image_position_y: number
  image_scale: number
  elements: DesignerPageElement[]
}

interface Props {
  cover:        ViewerCover | null
  fallbackBg:   string | null
  emblem:       string | null
  title:        string
}

/** Renders the FRONT panel of the saved cover (rightmost 612×792 of
 *  the 1248×792 wrap), using the same composition CoverCanvas uses in
 *  the designer. Coordinates are preserved by rendering the full
 *  1248×792 inner canvas inside a 612-wide clipping viewport, with
 *  the inner canvas pinned to the right so its front half is what's
 *  visible. */
export function CoverFrontView({ cover, fallbackBg, emblem, title }: Props) {
  const front_bg = cover?.front_bg ?? fallbackBg ?? '0D1B2A'

  // No cover composition yet — show a stand-in with title + emblem.
  if (!cover || (!cover.image_url && (cover.elements ?? []).length === 0)) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-5 shadow-lg"
        style={{ width: COVER_W, height: COVER_H, backgroundColor: `#${front_bg}` }}
      >
        {emblem && <span className="text-7xl leading-none">{emblem}</span>}
        <h1 className="px-6 text-center font-serif text-3xl font-bold text-cream leading-tight">
          {title}
        </h1>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden shadow-lg"
      style={{ width: COVER_W, height: COVER_H, backgroundColor: `#${front_bg}` }}
    >
      {/* Full-canvas (1248×792) inner stage, pinned to the right of the
          612-wide viewport so the front panel aligns with x=0..612 of
          what's visible. Back-panel content (x in [0, 612]) gets
          clipped; spine + front panel (x in [612, 1248]) is shown. */}
      <div
        className="absolute top-0 right-0"
        style={{ width: CANVAS_W, height: COVER_H }}
      >
        {/* Back panel bg — needed so cross-spine images and elements
            blend correctly across the spine even though only the
            front half is visible. */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: COVER_W, backgroundColor: `#${cover.back_bg ?? front_bg}` }}
        />
        {/* Front panel bg (fills the right half of the inner canvas). */}
        <div
          className="absolute inset-y-0"
          style={{ left: FRONT_X, width: COVER_W, backgroundColor: `#${front_bg}` }}
        />

        {/* Full-bleed image positioned across the whole 1248×792, same
            as the designer's preview. The objectPosition + transform
            put the image where the creator placed it. */}
        {cover.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: cover.image_opacity / 100,
              objectPosition: `${cover.image_position_x * 100}% ${cover.image_position_y * 100}%`,
              transform: `scale(${cover.image_scale})`,
              transformOrigin: `${cover.image_position_x * 100}% ${cover.image_position_y * 100}%`,
            }}
            draggable={false}
          />
        )}

        {/* Freely-placed elements — text blocks, lines. Coordinates
            are in the full 1248×792 space so back-panel ones fall off
            the visible viewport, which is correct. */}
        {(cover.elements ?? []).map((el) => (
          <ReadOnlyElement key={el.id} element={el} />
        ))}
      </div>
    </div>
  )
}

export { COVER_W as COVER_FRONT_W, COVER_H as COVER_FRONT_H }
