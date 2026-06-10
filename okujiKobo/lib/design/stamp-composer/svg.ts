/**
 * Stamp Composer — SVG serializer.
 *
 * Takes a ComposerMetadata (the live editing state) and emits a
 * static SVG string suitable for storage in the design_assets
 * bucket. Two invariants hold for every emitted SVG:
 *
 *   1. The root <svg> declares `xmlns="http://www.w3.org/2000/svg"`
 *      so it works as a standalone file fetched by an <img> or
 *      embedded in @react-pdf via fetch+inline.
 *
 *   2. Every stroke / fill is the literal string `currentColor`.
 *      This is what lets the designer canvas re-ink via the
 *      wrapper's CSS `color`. Mobile + PDF post-process the
 *      string and replace `currentColor` with the hex.
 *
 * Push 1 covers rect / ellipse / line. The other branches are
 * stubbed — they return empty strings so the serializer never
 * crashes on an unrecognized type; the canvas renderer is the
 * authoritative live preview during the staged rollout.
 */

import type {
  ComposerElement,
  ComposerMetadata,
  CurvedTextElement,
  EllipseElement,
  IconElement,
  LineElement,
  RectElement,
  TextElement,
  TracedElement,
  TriangleElement,
} from './types'
import { fontByKey } from '../fonts'
import { arcPathD, renderText } from './geometry'
import { computeContentBBox } from './bbox'

export function serializeStampSvg(doc: ComposerMetadata): string {
  const body = doc.elements.map(elementToSvg).join('\n  ')

  // Tight content-bounds viewBox so every renderer (kobo canvas,
  // mobile react-native-svg, react-pdf) scales-to-fit + centers
  // via the default preserveAspectRatio="xMidYMid meet" behavior.
  // No padding — the composer's stroke half-widths are already
  // baked into the bbox by elementBBox.
  //
  // Empty doc: fall back to the full surface. Save flow currently
  // permits empty save (rare; the modal usually has at least one
  // element from a preset), and a zero-extent viewBox would make
  // every consumer crash on division-by-zero.
  const bb = computeContentBBox(doc.elements)
  const vb = bb !== null
    ? `${num(bb.x)} ${num(bb.y)} ${num(bb.w)} ${num(bb.h)}`
    : `0 0 ${doc.surface.w} ${doc.surface.h}`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ` +
    `width="100%" height="100%" ` +
    `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">\n` +
    `  ${body}\n` +
    `</svg>`
  )
}

function elementToSvg(el: ComposerElement): string {
  switch (el.type) {
    case 'rect':       return rectSvg(el)
    case 'triangle':   return triangleSvg(el)
    case 'ellipse':    return ellipseSvg(el)
    case 'line':       return lineSvg(el)
    case 'text':       return textSvg(el)
    case 'curvedText': return curvedTextSvg(el)
    case 'icon':       return iconSvg(el)
    case 'traced':     return tracedSvg(el)
  }
}

// ── Element serializers ──────────────────────────────────────────────────────

function rectSvg(el: RectElement): string {
  const transform = rotationTransform(el.rotation, el.x + el.w / 2, el.y + el.h / 2)
  const fill = el.filled ? 'currentColor' : 'none'
  const dash = el.dashed ? ` stroke-dasharray="${el.strokeWidth * 3} ${el.strokeWidth * 2}"` : ''
  return (
    `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" ` +
    `rx="${num(el.rx ?? 0)}" fill="${fill}" stroke="currentColor" stroke-width="${num(el.strokeWidth)}"${dash}${transform} />`
  )
}

function triangleSvg(el: TriangleElement): string {
  const cx = (el.x1 + el.x2 + el.x3) / 3
  const cy = (el.y1 + el.y2 + el.y3) / 3
  const transform = rotationTransform(el.rotation, cx, cy)
  const fill = el.filled ? 'currentColor' : 'none'
  const dash = el.dashed ? ` stroke-dasharray="${el.strokeWidth * 3} ${el.strokeWidth * 2}"` : ''
  const pts = `${num(el.x1)},${num(el.y1)} ${num(el.x2)},${num(el.y2)} ${num(el.x3)},${num(el.y3)}`
  return (
    `<polygon points="${pts}" fill="${fill}" stroke="currentColor" stroke-width="${num(el.strokeWidth)}"${dash}${transform} />`
  )
}

function ellipseSvg(el: EllipseElement): string {
  const transform = rotationTransform(el.rotation, el.cx, el.cy)
  const fill = el.filled ? 'currentColor' : 'none'
  const dash = el.dashed ? ` stroke-dasharray="${el.strokeWidth * 3} ${el.strokeWidth * 2}"` : ''
  // Use <ellipse> always — when rx === ry it's a perfect circle
  // and renders identically across consumers.
  return (
    `<ellipse cx="${num(el.cx)}" cy="${num(el.cy)}" rx="${num(el.rx)}" ry="${num(el.ry)}" ` +
    `fill="${fill}" stroke="currentColor" stroke-width="${num(el.strokeWidth)}"${dash}${transform} />`
  )
}

function lineSvg(el: LineElement): string {
  const cx = (el.x1 + el.x2) / 2
  const cy = (el.y1 + el.y2) / 2
  const transform = rotationTransform(el.rotation, cx, cy)
  const dash = el.dashed ? ` stroke-dasharray="${el.strokeWidth * 3} ${el.strokeWidth * 2}"` : ''
  const cap = el.linecap ? ` stroke-linecap="${el.linecap}"` : ''
  return (
    `<line x1="${num(el.x1)}" y1="${num(el.y1)}" x2="${num(el.x2)}" y2="${num(el.y2)}" ` +
    `stroke="currentColor" stroke-width="${num(el.strokeWidth)}"${dash}${cap}${transform} />`
  )
}

function textAttrs(el: TextElement | CurvedTextElement): string {
  const f = fontByKey(el.fontFamily)
  const weight = el.bold   ? ' font-weight="700"'   : ''
  const style  = el.italic ? ' font-style="italic"' : ''
  const spacing = el.letterSpacing ? ` letter-spacing="${num(el.letterSpacing)}"` : ''
  // Use attribute-form font-family so it round-trips through
  // any SVG cleaner (vs CSS style="").
  return ` font-family="${escapeAttr(f.family)}" font-size="${num(el.fontSize)}"${weight}${style}${spacing}` +
         ` fill="currentColor" stroke="none"`
}

function textSvg(el: TextElement): string {
  // Anchor at element (x, y) interpreted as the text's baseline-
  // start point. The composer surfaces (x, y) as top-left of the
  // bounding box; we add fontSize so the baseline sits beneath.
  // Newlines in the source text become separate <tspan> lines
  // (canvas + serializer share the 1.2 line-height multiplier).
  const baselineY = el.y + el.fontSize * 0.82  // ~ baseline ratio for most faces
  const transform = rotationTransform(el.rotation, el.x, el.y + el.fontSize / 2)
  const t = renderText(el.text, { uppercase: el.uppercase })
  const lines = t.split('\n')
  const tspans = lines.map((line, i) => {
    const dy = i === 0 ? '' : ` dy="${num(el.fontSize * 1.2)}"`
    // Empty lines keep their vertical advance by carrying a
    // single space — SVG drops empty <tspan> bodies otherwise.
    return `<tspan x="${num(el.x)}"${dy}>${escapeText(line || ' ')}</tspan>`
  }).join('')
  return `<text x="${num(el.x)}" y="${num(baselineY)}"${textAttrs(el)}${transform}>${tspans}</text>`
}

function curvedTextSvg(el: CurvedTextElement): string {
  const t = renderText(el.text, { uppercase: el.uppercase })
  const pathId = `cp-${el.id}`
  const d = arcPathD(el.cx, el.cy, el.rx, el.ry, el.arc)
  const transform = rotationTransform(el.rotation, el.cx, el.cy)
  // <defs> on the same element so the path is local to this
  // composition's namespace and unlikely to collide.
  return (
    `<g${transform}>` +
      `<defs><path id="${pathId}" d="${d}" /></defs>` +
      `<text${textAttrs(el)} text-anchor="middle">` +
        `<textPath href="#${pathId}" startOffset="50%">${escapeText(t)}</textPath>` +
      `</text>` +
    `</g>`
  )
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function iconSvg(el: IconElement): string {
  // Icon's authoring viewBox (lucide = 24x24; custom okuji may
  // differ). Scale so the wider authoring dimension fits within
  // el.size; preserves aspect ratio.
  const [, , vbW, vbH] = parseViewBox(el.viewBox)
  const scale = el.size / Math.max(vbW, vbH)
  const cx = el.x + el.size / 2
  const cy = el.y + el.size / 2
  const transform = rotationTransform(el.rotation, cx, cy)
  return (
    `<g${transform}>` +
      `<g transform="translate(${num(el.x)} ${num(el.y)}) scale(${num(scale)})" ` +
      `stroke="currentColor" stroke-width="${num(el.strokeWidth)}" fill="none">` +
        el.svgContent +
      `</g>` +
    `</g>`
  )
}

function parseViewBox(vb: string): [number, number, number, number] {
  const parts = vb.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return [0, 0, 24, 24]
  return [parts[0], parts[1], parts[2], parts[3]]
}

function tracedSvg(el: TracedElement): string {
  // The tracer authored `d` in source-image pixel coordinates.
  // Map to (x, y, w, h) on the stamp surface via translate +
  // scale. The TracedElement carries sourceW/sourceH so the
  // mapping survives reopens.
  const sx = el.w / el.sourceW
  const sy = el.h / el.sourceH
  const cx = el.x + el.w / 2
  const cy = el.y + el.h / 2
  const rot = rotationTransform(el.rotation, cx, cy)
  const filled = el.filled !== false  // default true
  const fill   = filled ? 'currentColor' : 'none'
  const stroke = filled ? 'none' : 'currentColor'
  const sw     = filled ? '' : ` stroke-width="${num(el.strokeWidth ?? 1)}"`
  return (
    `<g${rot}>` +
      `<g transform="translate(${num(el.x)} ${num(el.y)}) scale(${num(sx)} ${num(sy)})">` +
        `<path d="${el.d}" fill="${fill}" fill-rule="evenodd" stroke="${stroke}"${sw} />` +
      `</g>` +
    `</g>`
  )
}

// ── Utils ────────────────────────────────────────────────────────────────────

function rotationTransform(deg: number | undefined, cx: number, cy: number): string {
  if (!deg) return ''
  return ` transform="rotate(${num(deg)} ${num(cx)} ${num(cy)})"`
}

/** Round to 2 decimals — keeps the SVG file small without
 *  visibly degrading stamp curves. */
function num(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}
