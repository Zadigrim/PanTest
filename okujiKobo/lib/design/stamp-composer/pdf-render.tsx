/**
 * Stamp Composer — SVG → @react-pdf JSX translator.
 *
 * Used by the print-PDF route to embed composed stamps inside
 * the location boxes on a passport page. @react-pdf's `<Image>`
 * doesn't load SVG file URLs (raster handler only), but its
 * `<Svg>` family of components accepts inline JSX, so the
 * pipeline is:
 *
 *   1. Server-side fetch the stamp's SVG file from storage.
 *   2. Replace `currentColor` with the per-stop stamp_color hex
 *      (matches the recoloring contract used on web + mobile).
 *   3. Parse the SVG with a small regex-driven walker (the
 *      composer's output dialect is constrained — no entities,
 *      no CDATA, no comments — so a real XML parser would be
 *      overkill).
 *   4. Translate each element into the corresponding
 *      @react-pdf primitive.
 *
 * Supported primitives (the composer's full output set):
 *   <rect> · <circle> · <ellipse> · <line> · <polygon> ·
 *   <polyline> · <path> · <g> · <defs> · <text>
 *
 * Limitations (acknowledged in the commit message, the README,
 * and the print-pdf route):
 *   - <textPath> is NOT supported by @react-pdf. Curved text
 *     falls through to a straight <Text> at the curve's center
 *     point. Top/bottom rim text reads as one line of straight
 *     text at the ellipse's center. Future opentype.js +
 *     font-embedded flatten-at-save would restore fidelity
 *     here; deferred as its own push.
 *   - Font fidelity is Helvetica-default in PDF since we don't
 *     register the stamp-composer font catalog with @react-pdf
 *     today. Glyph metrics differ slightly from the live
 *     designer canvas + mobile, but text content + size +
 *     bold/italic are preserved.
 */

import {
  Svg,
  Path,
  Rect,
  Circle,
  Ellipse,
  Line,
  Polygon,
  Polyline,
  G,
  Text as SvgText,
  Defs,
} from '@react-pdf/renderer'
import { substituteDateInSvg } from './date-token'

// ── Parser ──────────────────────────────────────────────────────────────────

interface ParsedNode {
  tag: string
  attrs: Record<string, string>
  /** Concatenated text content of any direct text children. */
  text?: string
  children: ParsedNode[]
}

/** Tokenize + recursively assemble nodes from an SVG string. The
 *  composer's serialized output is well-formed (quoted attrs,
 *  no comments, no CDATA), so this regex tokenizer is reliable
 *  for the dialect; not a general-purpose XML parser. */
function parseSvg(svg: string): ParsedNode | null {
  // Strip XML prolog if present, then locate the root <svg> tag.
  const cleaned = svg.replace(/<\?xml[\s\S]*?\?>/g, '').trim()
  const rootStart = cleaned.indexOf('<svg')
  if (rootStart < 0) return null
  const closeIdx = cleaned.lastIndexOf('</svg>')
  if (closeIdx < 0) return null
  const rootClose = cleaned.indexOf('>', rootStart)
  if (rootClose < 0) return null
  const rootAttrs = parseAttrs(cleaned.slice(rootStart + 4, rootClose).replace(/\/$/, ''))
  const inner = cleaned.slice(rootClose + 1, closeIdx)
  const children = parseSiblings(inner)
  return { tag: 'svg', attrs: rootAttrs, children }
}

/** Parse the contents of a tag — a flat sibling list. Recurses
 *  into element bodies. */
function parseSiblings(s: string): ParsedNode[] {
  const out: ParsedNode[] = []
  let i = 0
  while (i < s.length) {
    // Skip whitespace between tags.
    while (i < s.length && /\s/.test(s[i])) i++
    if (i >= s.length) break
    if (s[i] !== '<') {
      // Text run. Capture until next '<'; emit as a pseudo-node
      // so <text> bodies can read it.
      const end = s.indexOf('<', i)
      const text = end < 0 ? s.slice(i) : s.slice(i, end)
      if (text.trim()) out.push({ tag: '#text', attrs: {}, text, children: [] })
      i = end < 0 ? s.length : end
      continue
    }
    // Tag — locate '>' (handles self-closing).
    const tagEnd = s.indexOf('>', i)
    if (tagEnd < 0) break
    const raw = s.slice(i + 1, tagEnd)
    const selfClosing = raw.endsWith('/')
    const head = selfClosing ? raw.slice(0, -1).trim() : raw.trim()
    const spaceIdx = head.search(/\s/)
    const tag = (spaceIdx < 0 ? head : head.slice(0, spaceIdx)).toLowerCase()
    const attrsStr = spaceIdx < 0 ? '' : head.slice(spaceIdx + 1)
    const attrs = parseAttrs(attrsStr)

    if (selfClosing) {
      out.push({ tag, attrs, children: [] })
      i = tagEnd + 1
      continue
    }

    // Open tag — find the matching close.
    const closeTag = `</${tag}>`
    const closeIdx = s.indexOf(closeTag, tagEnd)
    if (closeIdx < 0) {
      // Unterminated; treat as self-closing to avoid infinite loop.
      out.push({ tag, attrs, children: [] })
      i = tagEnd + 1
      continue
    }
    const body = s.slice(tagEnd + 1, closeIdx)
    const children = parseSiblings(body)
    const directText = children
      .filter((c) => c.tag === '#text')
      .map((c) => c.text ?? '')
      .join('')
    out.push({
      tag,
      attrs,
      text: directText || undefined,
      children: children.filter((c) => c.tag !== '#text'),
    })
    i = closeIdx + closeTag.length
  }
  return out
}

/** Parse a string of `key="value"` pairs into a record. */
function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out[m[1].toLowerCase()] = decodeEntities(m[2])
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

// ── Translator ──────────────────────────────────────────────────────────────

/** Convert raw SVG attributes (string-valued) into @react-pdf
 *  props. @react-pdf's SVG primitives accept the same attribute
 *  names; type-coerce numeric ones for safety. */
function attrsToProps(attrs: Record<string, string>): Record<string, string | number> {
  const props: Record<string, string | number> = {}
  const NUMERIC = new Set([
    'x', 'y', 'width', 'height', 'rx', 'ry',
    'cx', 'cy', 'x1', 'y1', 'x2', 'y2',
    'stroke-width', 'font-size', 'letter-spacing',
  ])
  for (const [k, v] of Object.entries(attrs)) {
    if (NUMERIC.has(k)) {
      const n = Number(v)
      props[k] = Number.isFinite(n) ? n : v
    } else {
      props[k] = v
    }
  }
  return props
}

/** Translate one parsed node into a @react-pdf JSX element. */
function translateNode(node: ParsedNode, key: number): JSX.Element | null {
  // Strip <defs> — @react-pdf supports it, but the composer
  // only emits <defs><path id="cp-…"/></defs> for textPath, and
  // textPath isn't supported. Drop the defs so the path doesn't
  // float into the rendered output.
  if (node.tag === 'defs') return null

  // Pre-extract common props shared by most primitives.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = attrsToProps(node.attrs) as any

  switch (node.tag) {
    case 'rect':
      return <Rect key={key} {...p} />
    case 'circle':
      return <Circle key={key} {...p} />
    case 'ellipse':
      return <Ellipse key={key} {...p} />
    case 'line':
      return <Line key={key} {...p} />
    case 'polygon':
      return <Polygon key={key} {...p} />
    case 'polyline':
      return <Polyline key={key} {...p} />
    case 'path':
      return <Path key={key} {...p} />
    case 'g':
      return (
        <G key={key} {...p}>
          {node.children.map(translateNode)}
        </G>
      )
    case 'text': {
      // textPath inside <text> can't be rendered by @react-pdf;
      // fall back to the textPath's text content as a plain
      // centered string at the implied center. The composer
      // wraps curved text in <g transform=...><defs/><text>
      // <textPath>...</textPath></text></g>, so this branch
      // catches both straight and curved variants.
      const tp = node.children.find((c) => c.tag === 'textpath')
      // Multi-line straight text uses <tspan> children. We join
      // tspan text contents with newlines — @react-pdf's SvgText
      // honors literal \n. tspan position attrs (dy, x) are
      // dropped here because @react-pdf's Text doesn't accept
      // them; the vertical advance lands close-enough for stamp
      // labels at the sizes we use.
      const tspans = node.children.filter((c) => c.tag === 'tspan')
      const content = tp
        ? (tp.text ?? '')
        : tspans.length > 0
          ? tspans.map((ts) => ts.text ?? '').join('\n')
          : (node.text ?? '')
      // Strip text-only props @react-pdf doesn't know.
      const textProps = { ...p }
      delete textProps['text-anchor']
      delete textProps['letter-spacing']
      // Map SVG kebab-case to camelCase for the props @react-pdf
      // does take.
      if (p['text-anchor']) textProps.textAnchor = p['text-anchor']
      return (
        <SvgText key={key} {...textProps}>
          {content}
        </SvgText>
      )
    }
    default:
      return null
  }
}

// ── Public render entry ─────────────────────────────────────────────────────

/** Render a composed stamp SVG inside a @react-pdf <Svg>
 *  parented at (0, 0) sized to (width, height) in PDF points.
 *
 *  hexColor is applied via the same `currentColor` replacement
 *  the web canvas + mobile use, so all three consumers share the
 *  one recoloring contract.
 *
 *  Returns null on parse failure — callers should fall back to
 *  the location-box label so the PDF still renders SOMETHING for
 *  that stop. */
export function renderStampForPdf({
  svg,
  hexColor,
  width,
  height,
  earnedDate,
  ghost,
}: {
  svg: string
  hexColor: string
  width: number
  height: number
  /** Earned date (already formatted MM/DD/YYYY) for per-instance
   *  prints. Omit on blank-passport prints — the renderer falls
   *  back to today as a sample, matching the designer's preview. */
  earnedDate?: string | null
  /** Unearned/ghost rendering for the date token. With no
   *  earnedDate, ghost=true emits em-dashes; ghost=false emits
   *  today's date. */
  ghost?: boolean
}): JSX.Element | null {
  if (!svg) return null
  // Two pre-processing passes in order: recolor (currentColor →
  // hex) then date-token substitution. Order matters only because
  // both work on the same string; the operations don't interact
  // (the date token doesn't contain `currentColor` and vice versa).
  const recolored = svg.replace(/currentColor/g, hexColor)
  // When neither earnedDate nor ghost is set, the substitute
  // helper's resolver defaults to today's date — consistent with
  // the kobo designer's sample mode.
  const dated = substituteDateInSvg(recolored, {
    date: earnedDate ?? null,
    ghost: !!ghost,
  })
  const tree = parseSvg(dated)
  if (!tree) return null
  const viewBox = tree.attrs.viewbox ?? '0 0 256 256'
  return (
    <Svg viewBox={viewBox} style={{ width, height }}>
      {tree.children.map(translateNode)}
    </Svg>
  )
}
