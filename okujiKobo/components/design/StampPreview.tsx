'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Render a `design_assets`-typed stamp inside the designer canvas
 * (or anywhere else that wants the same re-inkable preview).
 *
 * Why this exists:
 *   - `<img src=".svg">` doesn't honor the CSS `color` of its
 *     parent, so the per-stop stamp_color can't re-ink an SVG
 *     file. Mobile + PDF currently render raster only.
 *   - The composer outputs SVGs that use `currentColor` for every
 *     stroke/fill. To re-ink in the web canvas we INLINE the SVG
 *     text and wrap it in a span whose CSS `color` carries the
 *     stamp_color through `currentColor`.
 *
 * Pipeline:
 *   1. Look up the asset by id (url + file_format).
 *   2. If SVG: fetch the file's text content, inject via
 *      dangerouslySetInnerHTML inside a span whose `color` is
 *      the per-stop ink. The SVG content is from our own bucket
 *      (vetted at upload by /api/assets/upload SVG monochrome
 *      checker); no third-party content reaches this path.
 *   3. Otherwise: render <img src={url}> (raster — no re-ink).
 *
 * In-memory cache so a passport with many stops sharing the same
 * stamp asset doesn't re-fetch.
 */

type CacheEntry = { url: string; isSvg: boolean; svgText?: string }
const ASSET_CACHE = new Map<string, CacheEntry>()
const INFLIGHT    = new Map<string, Promise<CacheEntry | null>>()

async function fetchAsset(assetId: string): Promise<CacheEntry | null> {
  const cached = ASSET_CACHE.get(assetId)
  if (cached) return cached
  const inflight = INFLIGHT.get(assetId)
  if (inflight) return inflight

  const promise = (async (): Promise<CacheEntry | null> => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('design_assets')
      .select('url, file_format')
      .eq('id', assetId)
      .single()
    if (!data?.url) return null
    const url = data.url as string
    const isSvg = data.file_format === 'image/svg+xml' || url.toLowerCase().endsWith('.svg')
    let svgText: string | undefined
    if (isSvg) {
      try {
        const res = await fetch(url)
        if (res.ok) svgText = await res.text()
      } catch { /* network — fall back to <img> path */ }
    }
    const entry: CacheEntry = { url, isSvg, svgText }
    ASSET_CACHE.set(assetId, entry)
    return entry
  })()
  INFLIGHT.set(assetId, promise)
  try {
    return await promise
  } finally {
    INFLIGHT.delete(assetId)
  }
}

export function StampPreview({
  assetId,
  color,
  size,
}: {
  assetId: string
  /** Hex without #; we add it. Falls back to default 1D9E75. */
  color: string | null | undefined
  /** Render size in px (square). */
  size: number
}) {
  const [entry, setEntry] = useState<CacheEntry | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    void fetchAsset(assetId).then((e) => {
      if (mountedRef.current) setEntry(e)
    })
  }, [assetId])

  const hex = `#${color ?? '1D9E75'}`

  if (!entry) {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-block' }}
        aria-hidden="true"
      />
    )
  }

  if (entry.isSvg && entry.svgText) {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-block', color: hex }}
        dangerouslySetInnerHTML={{ __html: entry.svgText }}
      />
    )
  }

  // Non-SVG (raster) — no re-inking. Matches existing mobile behavior.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={entry.url}
      alt=""
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }}
    />
  )
}
