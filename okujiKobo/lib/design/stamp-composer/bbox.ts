/**
 * Stamp Composer — content-bounds computation.
 *
 * Computes the tight axis-aligned bounding box of all drawn
 * elements so the serializer can emit a viewBox that fits the
 * content exactly. With a tight viewBox, every consumer (kobo
 * canvas, mobile react-native-svg, react-pdf) scales-to-fit and
 * centers via the default SVG `preserveAspectRatio="xMidYMid meet"`
 * behavior — no per-renderer fit logic needed.
 *
 * Each per-type formula computes a local AABB including stroke
 * half-width, then rotates the 4 corners around the element's
 * pivot and takes the AABB of those rotated corners. Rotation is
 * applied last so the union sees the rotated extent.
 *
 * Text width is estimated as fontSize × CHAR_WIDTH_RATIO × length.
 * Imprecise vs. canvas-measured but stable across consumers (the
 * three renderers don't share a font metric source) and over-
 * generous on the safe side for stamp use.
 *
 * The {{date}} token in text contents is sized against today's
 * date stand-in (MM/DD/YYYY = 10 chars) — date format is fixed-
 * width-ish so per-instance dates fit within the saved bbox.
 */

import type {
  ComposerElement,
  CurvedTextElement,
  EllipseElement,
  IconElement,
  LineElement,
  PolyshapeElement,
  RectElement,
  TextElement,
  TracedElement,
  TriangleElement,
} from './types'
import { hasDateToken } from './date-token'

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

/** Width-per-glyph multiplier on em. Conservative for most sans
 *  faces; bold widens by ~5% which we fold into the constant. */
const CHAR_WIDTH_RATIO = 0.62
/** Vertical span per text line in em (matches the serializer's
 *  1.2 line-height multiplier for multi-line tspans). */
const LINE_HEIGHT_RATIO = 1.2
/** Stand-in for the {{date}} token at bbox time — same character
 *  count as the resolved MM/DD/YYYY format the renderer emits. */
const DATE_TOKEN_STAND_IN = '00/00/0000'

/**
 * Compute the union AABB of every element. Returns null when the
 * doc has no elements (the caller decides what viewBox to emit
 * for an empty doc — typically the serializer falls back to the
 * surface dimensions in that case).
 */
export function computeContentBBox(elements: ComposerElement[]): BBox | null {
  if (elements.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of elements) {
    const b = elementBBox(el)
    if (!b) continue
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.w > maxX) maxX = b.x + b.w
    if (b.y + b.h > maxY) maxY = b.y + b.h
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function elementBBox(el: ComposerElement): BBox | null {
  switch (el.type) {
    case 'rect':       return rectBBox(el)
    case 'triangle':   return triangleBBox(el)
    case 'ellipse':    return ellipseBBox(el)
    case 'line':       return lineBBox(el)
    case 'polyshape':  return polyshapeBBox(el)
    case 'text':       return textBBox(el)
    case 'curvedText': return curvedTextBBox(el)
    case 'icon':       return iconBBox(el)
    case 'traced':     return tracedBBox(el)
  }
}

function rectBBox(el: RectElement): BBox {
  const sw = el.strokeWidth / 2
  const local = { x: el.x - sw, y: el.y - sw, w: el.w + el.strokeWidth, h: el.h + el.strokeWidth }
  return rotateBBox(local, el.rotation, el.x + el.w / 2, el.y + el.h / 2)
}

function triangleBBox(el: TriangleElement): BBox {
  const sw = el.strokeWidth / 2
  const xs = [el.x1, el.x2, el.x3]
  const ys = [el.y1, el.y2, el.y3]
  const local: BBox = {
    x: Math.min(...xs) - sw,
    y: Math.min(...ys) - sw,
    w: Math.max(...xs) - Math.min(...xs) + el.strokeWidth,
    h: Math.max(...ys) - Math.min(...ys) + el.strokeWidth,
  }
  const cx = (el.x1 + el.x2 + el.x3) / 3
  const cy = (el.y1 + el.y2 + el.y3) / 3
  return rotateBBox(local, el.rotation, cx, cy)
}

function polyshapeBBox(el: PolyshapeElement): BBox {
  // The outline is inscribed in the (x, y, w, h) box, so the box plus the
  // stroke half-width bounds it — same treatment as a rect.
  const sw = el.strokeWidth / 2
  const local = { x: el.x - sw, y: el.y - sw, w: el.w + el.strokeWidth, h: el.h + el.strokeWidth }
  return rotateBBox(local, el.rotation, el.x + el.w / 2, el.y + el.h / 2)
}

function ellipseBBox(el: EllipseElement): BBox {
  const sw = el.strokeWidth / 2
  const local: BBox = {
    x: el.cx - el.rx - sw,
    y: el.cy - el.ry - sw,
    w: 2 * el.rx + el.strokeWidth,
    h: 2 * el.ry + el.strokeWidth,
  }
  return rotateBBox(local, el.rotation, el.cx, el.cy)
}

function lineBBox(el: LineElement): BBox {
  // Conservative: bbox of the two endpoints expanded by strokeWidth/2
  // in every direction. Round-cap adds half a stroke past each end;
  // square-cap adds the same. Butt-cap adds nothing past endpoints
  // but is rarely used in stamps; the over-bound here is at most
  // strokeWidth and visually invisible at stamp render sizes.
  const sw = el.strokeWidth / 2
  const local: BBox = {
    x: Math.min(el.x1, el.x2) - sw,
    y: Math.min(el.y1, el.y2) - sw,
    w: Math.abs(el.x2 - el.x1) + el.strokeWidth,
    h: Math.abs(el.y2 - el.y1) + el.strokeWidth,
  }
  const cx = (el.x1 + el.x2) / 2
  const cy = (el.y1 + el.y2) / 2
  return rotateBBox(local, el.rotation, cx, cy)
}

function resolvedText(text: string): string {
  return hasDateToken(text) ? text.replace(/\{\{\s*date\s*\}\}/gi, DATE_TOKEN_STAND_IN) : text
}

function textBBox(el: TextElement): BBox {
  const t = resolvedText(el.text)
  // Per-line width = longest line's char count × glyph ratio × fontSize.
  // Empty lines still occupy vertical space (serializer emits ' ' so
  // the tspan retains its dy advance).
  const lines = t.split('\n')
  const maxLineChars = lines.reduce((m, l) => Math.max(m, l.length || 1), 0)
  const w = maxLineChars * CHAR_WIDTH_RATIO * el.fontSize
    + (el.letterSpacing ?? 0) * Math.max(0, maxLineChars - 1)
  const h = lines.length === 1
    ? el.fontSize
    : el.fontSize + (lines.length - 1) * el.fontSize * LINE_HEIGHT_RATIO
  // Alignment shifts the glyph extent relative to the x anchor: center
  // straddles x, right ends at x (matches the serializer's text-anchor).
  const bx = el.textAlign === 'center' ? el.x - w / 2 : el.textAlign === 'right' ? el.x - w : el.x
  const local: BBox = { x: bx, y: el.y, w, h }
  // Rotation pivot matches the serializer: (el.x, el.y + fontSize/2).
  return rotateBBox(local, el.rotation, el.x, el.y + el.fontSize / 2)
}

function curvedTextBBox(el: CurvedTextElement): BBox {
  // Arc occupies half of the ellipse (top half = cy - ry .. cy,
  // bottom half = cy .. cy + ry). Glyphs ride on one side of the
  // baseline; expand outward by fontSize to cover their extent.
  // Over-bounds by up to fontSize on the OPPOSITE side, which is
  // visually invisible at stamp render sizes.
  const ry = Math.max(el.ry, 0)
  const rx = Math.max(el.rx, 0)
  const yTop = el.arc === 'top'    ? el.cy - ry - el.fontSize : el.cy
  const yBot = el.arc === 'top'    ? el.cy                    : el.cy + ry + el.fontSize
  const local: BBox = {
    x: el.cx - rx - el.fontSize * 0.5,
    y: yTop,
    w: 2 * rx + el.fontSize,
    h: yBot - yTop,
  }
  return rotateBBox(local, el.rotation, el.cx, el.cy)
}

function iconBBox(el: IconElement): BBox {
  const local: BBox = { x: el.x, y: el.y, w: el.size, h: el.size }
  return rotateBBox(local, el.rotation, el.x + el.size / 2, el.y + el.size / 2)
}

function tracedBBox(el: TracedElement): BBox {
  // The traced path's `d` is in source pixels; the serializer maps
  // it to (x, y, w, h) via translate + scale. So the bbox on the
  // surface is exactly (x, y, w, h) plus strokeWidth/2 when
  // outlined.
  const sw = (el.filled === false ? (el.strokeWidth ?? 1) / 2 : 0)
  const local: BBox = {
    x: el.x - sw,
    y: el.y - sw,
    w: el.w + sw * 2,
    h: el.h + sw * 2,
  }
  return rotateBBox(local, el.rotation, el.x + el.w / 2, el.y + el.h / 2)
}

// ── Rotation helper ─────────────────────────────────────────────

/**
 * Rotate the 4 corners of `local` around (px, py) by `deg` and
 * return the AABB of the rotated corners. deg=0 or undefined →
 * returns local unchanged.
 */
function rotateBBox(local: BBox, deg: number | undefined, px: number, py: number): BBox {
  if (!deg) return local
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const corners: Array<[number, number]> = [
    [local.x, local.y],
    [local.x + local.w, local.y],
    [local.x, local.y + local.h],
    [local.x + local.w, local.y + local.h],
  ]
  const rotated = corners.map(([x, y]) => {
    const dx = x - px
    const dy = y - py
    return [px + dx * cos - dy * sin, py + dx * sin + dy * cos] as [number, number]
  })
  const xs = rotated.map((p) => p[0])
  const ys = rotated.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
