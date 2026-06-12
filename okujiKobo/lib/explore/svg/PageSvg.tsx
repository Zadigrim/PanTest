// Plain-SVG render of one passport page. Mirrors PageBackground + the
// designer's element/stop layers, but emits SVG nodes (not React-DOM
// styled divs) so it can be serialized with renderToStaticMarkup,
// loaded as an Image, and rasterized to a PNG canvas without any
// browser-only CSS getting lost. Used by lib/explore/render-to-png.ts
// at publish time.
//
// External image URLs (page background, image elements) must be
// pre-fetched and embedded as data: URIs BEFORE rendering — otherwise
// loading the SVG as an Image taints the canvas with cross-origin
// pixels and toBlob fails. lib/explore/publish-images.ts handles that
// pre-resolution.

import type {
  DesignerPageElement,
  ImagePageElement,
  TextPageElement,
  LinePageElement,
} from '@/lib/design/types'

// Same design-unit dimensions the designer Canvas uses, so coordinates
// from box_x / x / font sizes / etc. map 1:1.
export const PAGE_W = 612
export const PAGE_H = 792

export interface PageSvgInput {
  id: string
  paper_color: string | null
  background_type: string | null
  background_color: string | null
  background_opacity: number | null
  background_image_url: string | null  // already data: URI by the time it reaches here
  custom_background_opacity: number | null
  elements: DesignerPageElement[]
  stops: PageSvgStop[]
}

export interface PageSvgStop {
  id: string
  box_x: number | null
  box_y: number | null
  box_width: number | null
  box_height: number | null
  rotation: number | null
  stamp_icon: string | null
}

export function PageSvg({ page }: { page: PageSvgInput }) {
  const paper = `#${page.paper_color ?? 'FFFFFF'}`
  const patternColor = `#${page.background_color ?? '0D1B2A'}`
  const patternOpacity = Math.min(100, Math.max(10, page.background_opacity ?? 100)) / 100
  const customOpacity  = Math.min(100, Math.max(10, page.custom_background_opacity ?? 100)) / 100

  // Stable ids so multiple pages on the same SVG document don't collide.
  // Not strictly necessary here (each page renders standalone) but cheap.
  const guillocheId = `guilloche-${page.id}`
  const gridMinorId = `grid-minor-${page.id}`
  const gridMajorId = `grid-major-${page.id}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={PAGE_W}
      height={PAGE_H}
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
    >
      <defs>
        {/* Guilloche tile — two nested ellipses + a diamond, same as
            components/design/GuillochePattern.tsx. */}
        <pattern id={guillocheId} x={0} y={0} width={32} height={32} patternUnits="userSpaceOnUse">
          <ellipse cx={16} cy={16} rx={14} ry={7} fill="none" stroke={patternColor} strokeWidth={0.6} />
          <ellipse cx={16} cy={16} rx={14} ry={7} fill="none" stroke={patternColor} strokeWidth={0.6}
                   transform="rotate(45 16 16)" />
          <path d="M16,2 L30,16 L16,30 L2,16 Z" fill="none" stroke={patternColor} strokeWidth={0.4} />
        </pattern>
        {/* Grid — fine 12pt lines with 60pt major. */}
        <pattern id={gridMinorId} x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke={patternColor} strokeWidth={0.35} opacity={patternOpacity} />
        </pattern>
        <pattern id={gridMajorId} x={0} y={0} width={60} height={60} patternUnits="userSpaceOnUse">
          <rect width={60} height={60} fill={`url(#${gridMinorId})`} />
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke={patternColor} strokeWidth={0.8}
                opacity={Math.min(1, patternOpacity * 2.5)} />
        </pattern>
      </defs>

      {/* Paper bg */}
      <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={paper} />

      {/* Pattern overlay */}
      {page.background_type === 'guilloche' && (
        <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={`url(#${guillocheId})`} opacity={patternOpacity} />
      )}
      {page.background_type === 'grid' && (
        <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={`url(#${gridMajorId})`} />
      )}
      {page.background_type === 'custom' && page.background_image_url && (
        <image
          href={page.background_image_url}
          xlinkHref={page.background_image_url}
          x={0} y={0} width={PAGE_W} height={PAGE_H}
          preserveAspectRatio="xMidYMid meet"
          opacity={customOpacity}
        />
      )}

      {/* Elements (text, image, lines) */}
      {(page.elements ?? []).map((el) => (
        <ElementSvg key={el.id} element={el} />
      ))}

      {/* Stops (box outline + stamp icon as text) */}
      {(page.stops ?? []).map((stop) => (
        <StopSvg key={stop.id} stop={stop} />
      ))}
    </svg>
  )
}

function ElementSvg({ element }: { element: DesignerPageElement }) {
  if (element.type === 'text') {
    const el = element as TextPageElement
    const color = `#${el.color ?? '0D1B2A'}`
    // SVG text doesn't word-wrap natively. For first-pass fidelity we
    // place the content as a single <text> with `xml:space=preserve`
    // and let it render on one line; multi-line creator copy will look
    // truncated in the image until we add manual wrapping. Acceptable
    // for v1 because most cover/page text is short headings.
    const fontFamily = el.fontFamily ?? 'Arial, sans-serif'
    const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
    const tx = el.align === 'center' ? el.x + el.width / 2
             : el.align === 'right'  ? el.x + el.width
             : el.x
    // Approximate baseline placement: SVG text origin is the baseline,
    // not the top. We push down by ~0.8 * fontSize so the visual top
    // matches el.y.
    const fontSize = el.fontSize ?? 14
    const ty = el.y + fontSize * 0.85
    const rotateAttr = el.rotation ? `rotate(${el.rotation} ${tx} ${ty})` : undefined
    return (
      <text
        x={tx}
        y={ty}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={el.fontWeight ?? 'normal'}
        fill={color}
        textAnchor={anchor}
        transform={rotateAttr}
      >
        {el.content ?? ''}
      </text>
    )
  }

  if (element.type === 'richtext') {
    // SVG text doesn't word-wrap natively (same constraint as the 'text'
    // branch above). For published-image fidelity we lay each line out
    // as its own <tspan dy="1.3em">. Inline bold / italic / underline
    // would each need a per-run <tspan font-weight=…> wrapper; v1 image
    // export ships with PLAIN text (concatenated runs, line-broken). The
    // live page render + holder render are the truth surfaces; the
    // marketplace cover/page PNG is the degraded-acceptable surface.
    const el = element as import('@/lib/design/types').RichTextPageElement
    const fontFamily = el.fontFamily ?? 'Arial, sans-serif'
    const fontSize   = el.fontSize   ?? 13
    const color      = `#${el.color ?? '0D1B2A'}`
    const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
    const tx = el.align === 'center' ? el.x + el.width / 2
             : el.align === 'right'  ? el.x + el.width
             : el.x
    const ty = el.y + fontSize * 0.85
    const rotateAttr = el.rotation ? `rotate(${el.rotation} ${tx} ${ty})` : undefined
    const plain = el.runs.map((r) => r.text).join('')
    const lines = plain.split('\n')
    return (
      <text
        x={tx}
        y={ty}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fill={color}
        textAnchor={anchor}
        transform={rotateAttr}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={tx} dy={i === 0 ? 0 : `1.3em`}>{line}</tspan>
        ))}
      </text>
    )
  }

  if (element.type === 'image' || element.type === 'layout') {
    // Layout (table/grid) elements share the image slot in the static
    // SVG — alpha is preserved natively by the <image> element.
    const el = element as ImagePageElement
    if (!el.imageUrl) return null
    const rotateAttr = el.rotation ? `rotate(${el.rotation} ${el.x} ${el.y})` : undefined
    return (
      <image
        href={el.imageUrl}
        xlinkHref={el.imageUrl}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        preserveAspectRatio="xMidYMid meet"
        opacity={(el.opacity ?? 100) / 100}
        transform={rotateAttr}
      />
    )
  }

  if (element.type === 'hline') {
    return (
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.thickness ?? 2}
        fill={`#${element.lineColor ?? '0D1B2A'}`}
      />
    )
  }
  if (element.type === 'vline') {
    return (
      <rect
        x={element.x}
        y={element.y}
        width={element.thickness ?? 2}
        height={element.height}
        fill={`#${element.lineColor ?? '0D1B2A'}`}
      />
    )
  }
  if (element.type === 'line') {
    const el = element as LinePageElement
    return (
      <line
        x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
        stroke={`#${el.lineColor ?? '0D1B2A'}`}
        strokeWidth={el.thickness ?? 2}
        strokeLinecap="round"
      />
    )
  }

  return null
}

function StopSvg({ stop }: { stop: PageSvgStop }) {
  const x = stop.box_x ?? 40
  const y = stop.box_y ?? 40
  const w = stop.box_width ?? 120
  const h = stop.box_height ?? 120
  const rotation = stop.rotation ?? 0
  const stamp = stop.stamp_icon ?? '📍'
  const cx = x + w / 2
  const cy = y + h / 2
  const rotateAttr = rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined

  return (
    <g transform={rotateAttr}>
      <rect
        x={x} y={y} width={w} height={h}
        fill="rgba(255,255,255,0.35)"
        stroke="rgba(13, 27, 42, 0.25)"
        strokeWidth={2}
        strokeDasharray="6 4"
        rx={6}
      />
      <text
        x={cx}
        y={cy}
        fontSize={Math.min(w, h) * 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fillOpacity={0.6}
      >
        {stamp}
      </text>
    </g>
  )
}
