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
  EllipseElement,
  LineElement,
  RectElement,
} from './types'

export function serializeStampSvg(doc: ComposerMetadata): string {
  const w = doc.surface.w
  const h = doc.surface.h
  const body = doc.elements.map(elementToSvg).join('\n  ')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">\n` +
    `  ${body}\n` +
    `</svg>`
  )
}

function elementToSvg(el: ComposerElement): string {
  switch (el.type) {
    case 'rect':    return rectSvg(el)
    case 'ellipse': return ellipseSvg(el)
    case 'line':    return lineSvg(el)
    // Push 2+ — serializer branches added as elements land.
    case 'text':
    case 'curvedText':
    case 'icon':
    case 'traced':
      return ''
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
