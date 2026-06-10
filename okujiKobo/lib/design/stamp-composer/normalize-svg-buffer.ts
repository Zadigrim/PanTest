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
// Failure handling: any error returns the original buffer unchanged.
// Uploads should never block on normalization — a non-normalized SVG
// still renders, just possibly imperfectly. The user gets the file
// they uploaded back, no data loss.

import sharp from 'sharp'

const RENDER_DENSITY = 300
// Tolerance for what counts as "fully transparent." 1 = strict
// (pixel must be exactly transparent to trim). Higher values trim
// near-transparent edges; this works well for antialiased strokes.
const TRIM_THRESHOLD = 1

interface BBox { x: number; y: number; w: number; h: number }

export async function normalizeStampSvgBuffer(input: Buffer): Promise<Buffer> {
  try {
    const svgText = input.toString('utf-8')

    // Source coordinate space — viewBox if declared, else width/height.
    const src = readSvgDimensions(svgText)
    if (!src || src.w <= 0 || src.h <= 0) return input

    // Render at high density so trim is precise even for small content.
    const baseSharp = sharp(input, { density: RENDER_DENSITY })
    const renderedMeta = await baseSharp.metadata()
    const renderedW = renderedMeta.width
    const renderedH = renderedMeta.height
    if (!renderedW || !renderedH) return input

    // Trim transparent edges; sharp returns offsets into the original
    // rendered raster.
    const trimmed = await sharp(input, { density: RENDER_DENSITY })
      .trim({
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        threshold: TRIM_THRESHOLD,
      })
      .toBuffer({ resolveWithObject: true })

    const { width: tw, height: th, trimOffsetTop = 0, trimOffsetLeft = 0 } = trimmed.info
    if (!tw || !th) return input

    // Map pixel bbox → SVG coordinates. Renderer's pixel/SVG ratio
    // is renderedW/src.w (and the same vertical); apply per-axis to
    // tolerate non-square viewBoxes.
    const scaleX = renderedW / src.w
    const scaleY = renderedH / src.h
    // trimOffset is from the top-left of the rendered raster (which
    // covers the source viewBox's origin (src.x, src.y) at scale).
    const newBox: BBox = {
      x: src.x + trimOffsetLeft / scaleX,
      y: src.y + trimOffsetTop  / scaleY,
      w: tw / scaleX,
      h: th / scaleY,
    }

    // Tight zero-extent → degenerate; skip rewrite.
    if (newBox.w <= 0 || newBox.h <= 0) return input
    // If trimming was a no-op (full image kept), leave the file
    // untouched except for width/height 100% (still needed for
    // the kobo span path). Detect by comparing the trimmed dims
    // to the rendered dims within 1px.
    const trimmedAll = (
      Math.abs(tw - renderedW) <= 1 && Math.abs(th - renderedH) <= 1
    )

    const targetBox = trimmedAll ? src : newBox
    const out = rewriteRootSvg(svgText, targetBox)
    return Buffer.from(out, 'utf-8')
  } catch {
    return input
  }
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
