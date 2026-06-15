'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { getSideData, COVER_W, COVER_H } from '@/components/design/CoverCanvas'
import type { CoverSideData, DesignerPageElement } from '@/lib/design/types'

// Thumbnail output stays small for DB storage (cover_thumbnail is a base64
// PNG embedded in the row). We render to a downscaled canvas but draw with
// the full design-space coordinate system, then let the canvas transform
// scale everything down — so element positions/font sizes stay correct
// regardless of how COVER_W / COVER_H change.
const THUMB_W = 280
const THUMB_H = Math.round(THUMB_W * (COVER_H / COVER_W))  // preserves aspect
const DEBOUNCE_MS = 2000

// ── Canvas compositing ────────────────────────────────────────────────────────

function drawElement(ctx: CanvasRenderingContext2D, el: DesignerPageElement) {
  if (el.type === 'text') {
    const fs = el.fontSize ?? 14
    const fw = el.fontWeight ?? 'normal'
    const ff = el.fontFamily ?? 'serif'
    ctx.save()
    ctx.font = `${fw} ${fs}px ${ff}`
    ctx.fillStyle = el.color ? `#${el.color}` : '#ffffff'
    ctx.textAlign = el.align ?? 'left'
    ctx.textBaseline = 'top'

    const x = el.align === 'center'
      ? el.x + el.width / 2
      : el.align === 'right'
      ? el.x + el.width
      : el.x

    // Simple word-wrap
    const words = (el.content ?? '').split(' ')
    let line = ''
    let lineY = el.y
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > el.width && line) {
        ctx.fillText(line, x, lineY)
        line = word
        lineY += fs * 1.25
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, x, lineY)
    ctx.restore()

  } else if (el.type === 'hline') {
    const thick = el.thickness ?? 1
    ctx.save()
    ctx.fillStyle = el.lineColor ? `#${el.lineColor}` : '#ffffff'
    ctx.fillRect(el.x, el.y + (el.height - thick) / 2, el.width, thick)
    ctx.restore()

  } else if (el.type === 'vline') {
    const thick = el.thickness ?? 1
    ctx.save()
    ctx.fillStyle = el.lineColor ? `#${el.lineColor}` : '#ffffff'
    ctx.fillRect(el.x + (el.width - thick) / 2, el.y, thick, el.height)
    ctx.restore()
  }
}

async function compositeToDataUrl(side: CoverSideData): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const ctx = canvas.getContext('2d')!

  // Draw in design-space (COVER_W × COVER_H), let the transform handle the
  // downscale to THUMB_W × THUMB_H. This keeps element coordinates and font
  // sizes correct without per-element math.
  const scaleX = THUMB_W / COVER_W
  const scaleY = THUMB_H / COVER_H
  ctx.scale(scaleX, scaleY)

  // Layer 1: front background
  ctx.fillStyle = `#${side.front_bg}`
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  // Layer 2: cover image (if any).
  //
  // When the uploaded image is a full cover SPREAD (1252×869 aspect, or
  // any landscape ratio meaningfully wider than 1:1), we draw only its
  // FRONT-PANEL half (the right half of the source). The thumbnail
  // canvas is panel-sized (612×869 logical); drawing a 1252-wide source
  // at size (612, 869) without cropping would horizontally compress it
  // by 50% and the resulting thumbnail would show the WHOLE spread
  // squished into the panel area.
  //
  // Heuristic: aspect > 1.2 → treat as spread; otherwise draw whole.
  // Aspect 1.0..1.2 catches square-ish uploads that aren't really
  // spreads, and aspect ≤ 1.0 (portrait or square) is definitely a
  // panel-only upload.
  if (side.image_url) {
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const scale = side.image_scale ?? 1
        const scaledW = COVER_W * scale
        const scaledH = COVER_H * scale
        const ox = (COVER_W - scaledW) * (1 - (side.image_position_x ?? 0.5))
        const oy = (COVER_H - scaledH) * (1 - (side.image_position_y ?? 0.5))

        // Determine whether to crop to the front-panel half of the source.
        const sourceAspect = img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : 1
        const isSpread = sourceAspect > 1.2
        const sx = isSpread ? img.naturalWidth / 2 : 0
        const sw = isSpread ? img.naturalWidth / 2 : img.naturalWidth
        const sh = img.naturalHeight

        ctx.save()
        ctx.globalAlpha = (side.image_opacity ?? 80) / 100
        // 9-arg drawImage: source-rect + dest-rect. Source-rect picks
        // the right half (when isSpread) or the whole image.
        ctx.drawImage(img, sx, 0, sw, sh, ox, oy, scaledW, scaledH)
        ctx.restore()
        resolve()
      }
      img.onerror = () => resolve()
      img.src = side.image_url!
    })
  }

  // Layer 3: elements
  for (const el of side.elements ?? []) {
    drawElement(ctx, el)
  }

  return canvas.toDataURL('image/png')
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCoverThumbnail() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = usePassportStore.subscribe((state, prev) => {
      const passport = state.passport
      if (!passport) return

      const outside = passport.cover_outside_data
      const prevOutside = prev.passport?.cover_outside_data
      if (outside === prevOutside) return  // no cover change

      // Cancel any pending generation
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(async () => {
        timerRef.current = null

        const currentPassport = usePassportStore.getState().passport
        if (!currentPassport) return

        const side = getSideData(currentPassport.cover_outside_data)
        let dataUrl: string
        try {
          dataUrl = await compositeToDataUrl(side)
        } catch {
          return
        }

        // Persist to DB only. Skipping the local store update is
        // deliberate: passport.cover_thumbnail is only read by the
        // marketplace card surfaces (fetched fresh on next page-load),
        // never by the active designer session, so caching it in the
        // store earns nothing — and updatePassport() flips isDirty=true,
        // which would re-trigger the autosave loop forever.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createClient() as any
        await supabase
          .from('passports')
          .update({ cover_thumbnail: dataUrl })
          .eq('id', currentPassport.id)
      }, DEBOUNCE_MS)
    })

    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
