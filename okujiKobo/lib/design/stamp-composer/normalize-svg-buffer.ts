// Normalize an uploaded SVG buffer so its rendered output fills its
// stop box centered.
//
// The mechanism:
//   1. Render the SVG to a high-resolution raster via sharp (libvips
//      rsvg).
//   2. Trim transparent edges to find the visible content bbox in
//      pixel coordinates.
//   3. Read the SVG's existing viewBox (or fall back to its declared
//      width/height) to know the source coordinate space.
//   4. Map the pixel bbox back to SVG coordinates.
//   5. Rewrite the root <svg> with a tight viewBox + width="100%"
//      height="100%" so renderers (kobo span via dangerouslySetInnerHTML,
//      mobile SvgXml, react-pdf Svg) scale-to-fit + center via the
//      default preserveAspectRatio="xMidYMid meet".
//
// Failure handling: THROWS StampNormalizeError on any failure (render error,
// empty/contentless raster, invalid frame). It never returns the input
// un-normalized — a raw stamp would mis-place at render time. The upload route
// catches the throw and REJECTS the upload with a clear message, so no
// un-normalized stamp is ever stored. Fail loud, never silent.

import sharp from 'sharp'

const RENDER_DENSITY = 300
// Tolerance for what counts as "fully transparent." 1 = strict
// (pixel must be exactly transparent to trim). Higher values trim
// near-transparent edges; this works well for antialiased strokes.
const TRIM_THRESHOLD = 1

interface BBox { x: number; y: number; w: number; h: number }

export class StampNormalizeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StampNormalizeError'
  }
}

export async function normalizeStampSvgBuffer(input: Buffer): Promise<Buffer> {
  const svgText = input.toString('utf-8')

  // Render to raster first so both sides of the bbox math share pixel units.
  // A render failure means the content can't be measured — the stamp must NOT
  // be stored raw (it would mis-place at render time). Throw → upload rejects.
  let rendered: { data: Buffer; info: { width: number; height: number } }
  try {
    rendered = await sharp(input, { density: RENDER_DENSITY })
      .png()
      .toBuffer({ resolveWithObject: true })
  } catch (e) {
    throw new StampNormalizeError(`Could not render the stamp SVG (${(e as Error).message}).`)
  }
  const renderedWpx = rendered.info.width
  const renderedHpx = rendered.info.height
  if (!renderedWpx || !renderedHpx) {
    throw new StampNormalizeError('The stamp SVG rendered to an empty image.')
  }

  // Reject fully-transparent SVGs: trim leaves an all-transparent raster
  // un-cropped, which would otherwise slip through as "fills the frame". A
  // stamp with no visible content is not a usable stamp.
  try {
    const alpha = (await sharp(rendered.data).stats()).channels[3]
    if (alpha && alpha.max === 0) {
      throw new StampNormalizeError('The stamp SVG has no visible content.')
    }
  } catch (e) {
    if (e instanceof StampNormalizeError) throw e
    // A stats failure on otherwise-valid pixels shouldn't reject — fall through.
  }

  // Source coordinate space — a usable viewBox or ABSOLUTE px width/height is
  // required to map the raster content bbox back to the SVG's own user units.
  // A frameless (or %-sized) SVG can't be reframed reliably from the raster
  // alone (libvips' render scale for it isn't recoverable to user units), so we
  // REJECT it rather than store a guessed frame — the previous null-passthrough
  // is what let raw stamps slip through.
  const src = readSvgDimensions(svgText)
  if (!src || src.w <= 0 || src.h <= 0) {
    throw new StampNormalizeError(
      'The stamp SVG has no usable viewBox or pixel size. Re-export it with a viewBox (a single fixed artboard).',
    )
  }

  let trimmed: {
    info: { width: number; height: number; trimOffsetTop?: number; trimOffsetLeft?: number }
  }
  try {
    trimmed = await sharp(rendered.data)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: TRIM_THRESHOLD })
      .toBuffer({ resolveWithObject: true })
  } catch (e) {
    throw new StampNormalizeError(`Could not measure the stamp content (${(e as Error).message}).`)
  }

  const { width: tw, height: th, trimOffsetTop = 0, trimOffsetLeft = 0 } = trimmed.info
  if (!tw || !th) {
    throw new StampNormalizeError('The stamp SVG has no visible content to frame.')
  }

  const pxPerUnitX = renderedWpx / src.w
  const pxPerUnitY = renderedHpx / src.h
  // THE BUG FIX: sharp's trim offsets are the cropped margins and can be
  // NEGATIVE (observed: trimOffsetLeft=-250 for content 250px in). The old
  // code did `src.x + trimOffsetLeft/px`, adding the negative → wrong origin →
  // every uploaded SVG stamp framed off-center/clipped. Take the magnitude so
  // the content origin is correct regardless of sharp's sign convention.
  const newBox: BBox = {
    x: src.x + Math.abs(trimOffsetLeft) / pxPerUnitX,
    y: src.y + Math.abs(trimOffsetTop)  / pxPerUnitY,
    w: tw / pxPerUnitX,
    h: th / pxPerUnitY,
  }
  if (!(newBox.w > 0) || !(newBox.h > 0)) {
    throw new StampNormalizeError('Stamp normalization produced an invalid frame.')
  }

  // No-trim case: content already fills the frame — keep the source viewBox,
  // just add width/height=100% for the inline-SVG render paths.
  const trimmedAll = Math.abs(tw - renderedWpx) <= 1 && Math.abs(th - renderedHpx) <= 1
  const targetBox = trimmedAll ? src : newBox
  return Buffer.from(rewriteRootSvg(svgText, targetBox), 'utf-8')
}

// ── Helpers ────────────────────────────────────────────────────────

function readSvgDimensions(svg: string): BBox | null {
  const rootMatch = svg.match(/<svg\b[^>]*>/i)
  if (!rootMatch) return null
  const attrs = rootMatch[0]
  const vb = attrs.match(/\bviewBox\s*=\s*"([^"]+)"/i)
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] }
    }
  }
  const w = numAttr(attrs, 'width')
  const h = numAttr(attrs, 'height')
  if (w && h) return { x: 0, y: 0, w, h }
  return null
}

function numAttr(s: string, name: string): number | null {
  const m = s.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, 'i'))
  if (!m) return null
  // Percentage sizes (e.g. width="100%") are NOT an absolute frame — they
  // don't pin the user-unit space, so treat them as "no usable size".
  if (m[1].includes('%')) return null
  // Strip unit suffixes like px / pt — bare number is what we want.
  const n = parseFloat(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function rewriteRootSvg(svg: string, bbox: BBox): string {
  // Replace viewBox + width + height on the root <svg> only. Inner
  // elements left alone. Quoting around the four bbox values uses
  // toFixed(2) to keep file size tight without visible precision loss.
  const vb = `${num(bbox.x)} ${num(bbox.y)} ${num(bbox.w)} ${num(bbox.h)}`
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let cleaned = attrs
      .replace(/\s+viewBox\s*=\s*"[^"]*"/i, '')
      .replace(/\s+width\s*=\s*"[^"]*"/i, '')
      .replace(/\s+height\s*=\s*"[^"]*"/i, '')
    if (!cleaned.startsWith(' ')) cleaned = ' ' + cleaned
    return `<svg${cleaned} viewBox="${vb}" width="100%" height="100%">`
  })
}

function num(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}
