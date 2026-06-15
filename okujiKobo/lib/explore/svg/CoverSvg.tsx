// Front-cover SVG for the publish-time page-image render.
// The saved cover is a 1252×869 wrap (back | spine | front). The viewer
// shows the rightmost 612×869, so we render the full wrap into a 1252-
// wide viewBox and clip the left back-panel half via a 612-wide viewport
// translated -640. Image position / scale / opacity are applied exactly
// the way the designer's CoverCanvas does so the front-panel result
// matches what the creator placed.
//
// Same data-URI pre-resolution rule as PageSvg applies for any external
// image URLs.

import type { DesignerPageElement } from '@/lib/design/types'
import { PAGE_W as PANEL_W, PAGE_H as COVER_H } from './PageSvg'

const SPINE_W  = 28
const CANVAS_W = PANEL_W * 2 + SPINE_W // 1252
const FRONT_X  = PANEL_W + SPINE_W      // 640

export interface CoverSvgInput {
  front_bg: string | null
  back_bg:  string | null
  image_url: string | null  // already data: URI by the time it reaches here
  image_opacity: number
  image_position_x: number
  image_position_y: number
  image_scale: number
  elements: DesignerPageElement[]
  // Fallback content when no cover composition is saved.
  fallbackBg: string | null
  emblem: string | null
  title: string
}

export function CoverSvg({ cover }: { cover: CoverSvgInput }) {
  const front_bg = `#${cover.front_bg ?? cover.fallbackBg ?? '0D1B2A'}`
  const back_bg  = `#${cover.back_bg ?? cover.front_bg ?? cover.fallbackBg ?? '0D1B2A'}`

  // Empty-composition fallback: title + emblem centered.
  if (!cover.image_url && (cover.elements ?? []).length === 0) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={PANEL_W}
        height={COVER_H}
        viewBox={`0 0 ${PANEL_W} ${COVER_H}`}
      >
        <rect x={0} y={0} width={PANEL_W} height={COVER_H} fill={front_bg} />
        {cover.emblem && (
          <text
            x={PANEL_W / 2}
            y={COVER_H / 2 - 30}
            fontSize={84}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {cover.emblem}
          </text>
        )}
        <text
          x={PANEL_W / 2}
          y={COVER_H / 2 + 60}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={32}
          fontWeight="bold"
          fill="#F5F0E8"
          textAnchor="middle"
        >
          {cover.title}
        </text>
      </svg>
    )
  }

  // Image positioning math, in the full 1252×869 wrap coordinate space,
  // mirrors CoverCanvas's <img> with objectPosition + transform: scale.
  // We render the image larger than the panel and offset it so the
  // creator's chosen anchor point lands in the right spot.
  //
  // Background-image positioning: the image's anchor (image_position_x,
  // image_position_y) maps to the same fractional point of the visible
  // panel. We render a scaled image and shift it so that fractional
  // point lines up.
  const scale = cover.image_scale
  const renderedW = CANVAS_W * scale
  const renderedH = COVER_H * scale
  // Top-left of the rendered image, computed so the chosen anchor lands
  // on the same fractional point of the wrap.
  const imgX = cover.image_position_x * CANVAS_W - cover.image_position_x * renderedW
  const imgY = cover.image_position_y * COVER_H  - cover.image_position_y * renderedH

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={PANEL_W}
      height={COVER_H}
      viewBox={`${FRONT_X} 0 ${PANEL_W} ${COVER_H}`}
    >
      {/* Back-panel bg (rendered for elements that cross the spine; the
          viewBox above clips it out of the front-only viewport). */}
      <rect x={0} y={0} width={PANEL_W} height={COVER_H} fill={back_bg} />
      {/* Front-panel bg */}
      <rect x={FRONT_X} y={0} width={PANEL_W} height={COVER_H} fill={front_bg} />

      {cover.image_url && (
        <image
          href={cover.image_url}
          xlinkHref={cover.image_url}
          x={imgX}
          y={imgY}
          width={renderedW}
          height={renderedH}
          preserveAspectRatio="xMidYMid slice"
          opacity={cover.image_opacity / 100}
        />
      )}

      {(cover.elements ?? []).map((el) => (
        <ElementOnCover key={el.id} element={el} />
      ))}
    </svg>
  )
}

// Lightweight element renderer for cover overlays — same primitives as
// PageSvg's ElementSvg but inlined to avoid pulling page-specific
// defaults onto the cover. Kept small intentionally; if cover element
// support grows we'll factor a shared helper.
function ElementOnCover({ element }: { element: DesignerPageElement }) {
  if (element.type === 'text') {
    const color = `#${element.color ?? 'F5F0E8'}`
    const fontFamily = element.fontFamily ?? 'Georgia, serif'
    const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start'
    const tx = element.align === 'center' ? element.x + element.width / 2
             : element.align === 'right'  ? element.x + element.width
             : element.x
    const fontSize = element.fontSize ?? 14
    const ty = element.y + fontSize * 0.85
    const rotateAttr = element.rotation ? `rotate(${element.rotation} ${tx} ${ty})` : undefined
    return (
      <text
        x={tx} y={ty}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={element.fontWeight ?? 'normal'}
        fill={color}
        textAnchor={anchor}
        transform={rotateAttr}
      >
        {element.content ?? ''}
      </text>
    )
  }
  if (element.type === 'image' && element.imageUrl) {
    const rotateAttr = element.rotation ? `rotate(${element.rotation} ${element.x} ${element.y})` : undefined
    return (
      <image
        href={element.imageUrl}
        xlinkHref={element.imageUrl}
        x={element.x} y={element.y}
        width={element.width} height={element.height}
        preserveAspectRatio="xMidYMid meet"
        opacity={(element.opacity ?? 100) / 100}
        transform={rotateAttr}
      />
    )
  }
  return null
}
