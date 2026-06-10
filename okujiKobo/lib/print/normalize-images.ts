// Server-side image normalizer for the print PDF route.
//
// Problem: @react-pdf/renderer delegates image fetch + decode to pdfkit.
// pdfkit's PNG decoder has well-known gaps — 16-bit depth, Adam7
// interlacing, embedded ICC profiles, certain tRNS/palette combinations
// for alpha all cause silent decode failures. The Image slot renders
// empty, and from the user's perspective "some images render, others
// don't" with no error logged.
//
// Solution: fetch every image bytes server-side, decode with sharp
// (handles every PNG variant, JPEG, WebP), composite onto a solid
// background (flattens any alpha — pdfkit doesn't need to worry about
// transparency at all), and re-encode as a baseline JPEG that pdfkit's
// rock-solid JPEG decoder will always accept.
//
// We never throw on a single failure — a bad image logs a warning and
// is dropped (the slot renders empty in the PDF). This matches the prior
// behaviour for any image that already failed, but with diagnostics.

import sharp from 'sharp'

const FETCH_TIMEOUT_MS = 15_000
const MAX_PARALLEL = 6
// JPEG quality. 88 is visually lossless for book-cover thumbnails at
// the sizes the print layout uses (180px tall and below).
const JPEG_QUALITY = 88
// Hard upper bound on resampled output. Keeps PDF file size in check
// — print layout never displays bigger than ~600x400 at letter size.
const MAX_DIMENSION = 1600

export interface NormalizeContext {
  /** Hex color (no leading #) used as the flattening background when
   *  the source has alpha. The route passes each image's destination
   *  paper color so flattened pixels match what the user designed —
   *  page element images use their page's paper_color, cover images
   *  use cover_paper_color, etc. Ignored when preserveAlpha is set. */
  paperHex: string
  /** When true, keep the source's alpha channel instead of flattening
   *  onto paperHex: re-encode as a clean 8-bit, non-interlaced RGBA PNG
   *  (the subset pdfkit decodes reliably) so transparency survives into
   *  the PDF. Used for stamp images, which sit in boxes over page
   *  backgrounds and must not carry a paper-colored rectangle. */
  preserveAlpha?: boolean
}

/** A single image to normalize, with the paper colour its transparent
 *  pixels should blend into. Different pages on the same passport can
 *  have different paper colours; flattening on the wrong one shows
 *  up as a visible bounding rectangle where the alpha-flattened pixels
 *  meet the actual page background. Set preserveAlpha to skip flattening
 *  entirely and keep transparency (stamp images). */
export interface NormalizeItem {
  url: string
  paperHex: string
  preserveAlpha?: boolean
}

/** Key for the Map returned by normalizeAll. Exposed so callers can
 *  look up images they queued. Lowercased so 'FFFFFF' and 'ffffff'
 *  collapse to one cache key. preserveAlpha is part of the key so the
 *  same URL requested both flattened and alpha-preserved stays
 *  distinct. */
export function normalizeKey(url: string, paperHex: string, preserveAlpha = false): string {
  return `${url}::${paperHex.replace(/^#/, '').toLowerCase()}::${preserveAlpha ? 'a' : 'j'}`
}

function paperHexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, '').toLowerCase()
  if (!/^[0-9a-f]{6}$/.test(h)) return { r: 245, g: 242, b: 236 } // F5F2EC default
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Returns a `data:image/jpeg;base64,...` URL or null on failure. */
export async function normalizeImage(
  url: string,
  ctx: NormalizeContext,
): Promise<string | null> {
  const bytes = await fetchBytes(url)
  if (!bytes) {
    console.warn('[print-pdf] image fetch failed:', url)
    return null
  }
  try {
    const base = sharp(bytes, { failOn: 'none' })
      .rotate() // honour EXIF orientation
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })

    if (ctx.preserveAlpha) {
      // Keep transparency. Re-encode to the PNG subset pdfkit handles
      // cleanly: 8-bit depth, no interlace, full RGBA (no palette), sRGB,
      // metadata/ICC stripped (sharp drops metadata unless asked to keep
      // it). This avoids the 16-bit / Adam7 / ICC decode gaps that the
      // JPEG path was built to dodge, while preserving the alpha channel.
      const out = await base
        .toColourspace('srgb')
        .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false, force: true })
        .toBuffer()
      return `data:image/png;base64,${out.toString('base64')}`
    }

    const bg = paperHexToRgb(ctx.paperHex)
    const out = await base
      // Flatten any alpha onto the surrounding paper color. JPEG output
      // discards transparency anyway; doing the composite explicitly
      // means edge pixels of partially-transparent PNGs blend to the
      // page color we expect, not pure white.
      .flatten({ background: { r: bg.r, g: bg.g, b: bg.b } })
      .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' })
      .toBuffer()
    return `data:image/jpeg;base64,${out.toString('base64')}`
  } catch (err) {
    console.warn('[print-pdf] image decode failed:', url, err)
    return null
  }
}

/** Concurrency-limited batch normalize.
 *  Returns a map keyed by `${url}::${paperHex}` (use normalizeKey()) so
 *  the same image flattened onto different paper colours stays
 *  distinct. Each (url, paperHex) pair is normalized at most once. */
export async function normalizeAll(
  items: NormalizeItem[],
): Promise<Map<string, string>> {
  const seen = new Set<string>()
  const unique: NormalizeItem[] = []
  for (const it of items) {
    if (!it.url) continue
    const k = normalizeKey(it.url, it.paperHex, it.preserveAlpha)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(it)
  }

  const out = new Map<string, string>()
  let cursor = 0

  async function worker() {
    while (cursor < unique.length) {
      const i = cursor++
      const it = unique[i]
      const result = await normalizeImage(it.url, { paperHex: it.paperHex, preserveAlpha: it.preserveAlpha })
      if (result) out.set(normalizeKey(it.url, it.paperHex, it.preserveAlpha), result)
    }
  }

  const workers = Array.from({ length: Math.min(MAX_PARALLEL, unique.length) }, () => worker())
  await Promise.all(workers)
  return out
}
