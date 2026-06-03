'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { CoverFrontView, COVER_FRONT_W, COVER_FRONT_H, type ViewerCover } from './CoverFrontView'
import { PageView, type ViewerPage } from './PageView'

interface Props {
  cover:           ViewerCover | null
  pages:           ViewerPage[]
  fallbackBg:      string | null
  emblem:          string | null
  title:           string
  // Pre-rendered image URLs from the publish-time pipeline. When
  // present they're used instead of live-rendering the page tree.
  // null entries fall through to live-render for that slot.
  coverImageUrl?:  string | null
  pageImageUrls?:  string[] | null
}

// Spread gutter (px between left and right pages of a 2-page spread).
const SPREAD_GUTTER = 12
// Intrinsic stage width = two pages + gutter for spreads, or one page width
// for the cover. We pick the larger of the two so the layout doesn't jump
// when flipping between cover and spreads.
const STAGE_W = COVER_FRONT_W * 2 + SPREAD_GUTTER
const STAGE_H = COVER_FRONT_H

// State machine:
//   viewIdx = 0          → front cover
//   viewIdx = 1..N       → page spread N (pages [(N-1)*2, (N-1)*2 + 1])
//
// Right arrow advances viewIdx through cover → spread 1 → … → last spread.
// Left arrow walks back. The cover and the spreads share the same stage
// dimensions so the surrounding chrome doesn't reflow on each flip.

export function PassportViewer({
  cover, pages, fallbackBg, emblem, title,
  coverImageUrl, pageImageUrls,
}: Props) {
  const [viewIdx, setViewIdx] = useState(0)
  const spreadCount = Math.ceil(pages.length / 2)
  const maxViewIdx  = spreadCount   // 0 = cover, then 1..spreadCount spreads
  const hasPages    = pages.length > 0

  const goPrev = useCallback(() => setViewIdx((v) => Math.max(0, v - 1)), [])
  const goNext = useCallback(
    () => setViewIdx((v) => Math.min(maxViewIdx, v + 1)),
    [maxViewIdx],
  )

  // Keyboard navigation — ←/→ flip the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  // Scale the intrinsic 1236×792 stage to fit the container width so the
  // viewer reads as a book spread on any screen. We measure the parent's
  // width and apply CSS transform: scale rather than re-laying-out the
  // pages, so the page coordinates (box_x, font sizes, etc.) stay in the
  // design's 612×792 unit system.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width
      setScale(Math.min(1, cw / STAGE_W))
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const leftPage:  ViewerPage | null = viewIdx === 0 ? null : pages[(viewIdx - 1) * 2]     ?? null
  const rightPage: ViewerPage | null = viewIdx === 0 ? null : pages[(viewIdx - 1) * 2 + 1] ?? null

  const showLeftArrow  = viewIdx > 0
  const showRightArrow = hasPages && viewIdx < maxViewIdx

  return (
    <div className="relative w-full bg-paper py-10">
      {/* Stage wrapper measures available width; the inner stage scales
          to fit. Height is set explicitly to STAGE_H * scale so the
          surrounding page layout doesn't get pushed around by the
          transform (transform alone doesn't shrink the layout box). */}
      <div className="relative mx-auto w-full max-w-[1280px] px-4">
        <div ref={wrapRef} className="relative w-full">
          <div
            style={{ height: STAGE_H * scale }}
            className="relative w-full"
          >
            <div
              style={{
                width: STAGE_W,
                height: STAGE_H,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                left: '50%',
                top: 0,
              }}
            >
              {viewIdx === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CoverFrontView
                    cover={cover}
                    fallbackBg={fallbackBg}
                    emblem={emblem}
                    title={title}
                    imageUrl={coverImageUrl ?? null}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-start justify-center gap-[12px]">
                  <PageView
                    page={leftPage}
                    imageUrl={pickPageUrl(pageImageUrls, leftPage)}
                  />
                  <PageView
                    page={rightPage}
                    imageUrl={pickPageUrl(pageImageUrls, rightPage)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Arrows — outside the stage so they don't scale with it.
              Tucked to the page-area edges on large viewports, and
              kept at safe gutter offsets on narrow ones. */}
          <NavButton
            side="left"
            disabled={!showLeftArrow}
            onClick={goPrev}
            label="Previous"
          />
          <NavButton
            side="right"
            disabled={!showRightArrow}
            onClick={goNext}
            label="Next"
          />
        </div>

        {/* Progress / location indicator */}
        <p className="mt-5 text-center text-sm text-muted">
          {viewIdx === 0 ? (
            <span>Front cover</span>
          ) : (
            <span>
              {spreadLabel(viewIdx, pages.length)} of {pages.length}
              {pages.length === 1 ? '' : ' pages'}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

function pickPageUrl(urls: string[] | null | undefined, page: ViewerPage | null): string | null {
  if (!page || !urls) return null
  // page_image_urls is indexed by page_order — the publish-images
  // upload preserves that ordering. If the slot is missing or empty
  // we fall through to live-render.
  const u = urls[page.page_order]
  return typeof u === 'string' && u.length > 0 ? u : null
}

function spreadLabel(viewIdx: number, totalPages: number): string {
  const first = (viewIdx - 1) * 2 + 1
  const second = Math.min(viewIdx * 2, totalPages)
  return first === second ? `Page ${first}` : `Pages ${first}–${second}`
}

function NavButton({
  side,
  disabled,
  onClick,
  label,
}: {
  side:     'left' | 'right'
  disabled: boolean
  onClick:  () => void
  label:    string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 z-10',
        'flex h-12 w-12 items-center justify-center rounded-full',
        'border border-hairline bg-white text-2xl text-navy shadow-md',
        'transition-colors hover:border-green hover:text-green',
        'disabled:pointer-events-none disabled:opacity-30',
        side === 'left' ? 'left-2 sm:left-6' : 'right-2 sm:right-6',
      )}
    >
      {side === 'left' ? '←' : '→'}
    </button>
  )
}
