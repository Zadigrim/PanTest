'use client'

import { GuillochePattern } from './GuillochePattern'
import type { BackgroundType } from '@/lib/design/types'

// Narrow structural type — every field this component actually reads,
// with nullability matched to both the designer's hydrated shape and
// the Explore viewer's read-only shape that comes straight from the
// DB. Defaults applied below cover null values either way.
interface PageBackgroundFields {
  id: string
  paper_color: string | null
  background_color: string | null
  background_opacity: number | null
  custom_background_opacity: number | null
  background_type: BackgroundType
  background_image_url: string | null
}

interface Props {
  page: PageBackgroundFields
  children?: React.ReactNode
}

/** Three-layer background: paper color → pattern/image → grain texture. */
export function PageBackground({ page, children }: Props) {
  const paper = `#${page.paper_color ?? 'F5F2EC'}`
  const patternColor = `#${page.background_color ?? '0D1B2A'}`
  const opacity = Math.min(100, Math.max(10, page.background_opacity ?? 100))
  const customOpacity = Math.min(100, Math.max(10, page.custom_background_opacity ?? 100))

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: paper }}
    >
      {page.background_type === 'guilloche' && (
        <GuillochePattern opacity={opacity} color={patternColor} patternId={`guilloche-${page.id}`} />
      )}
      {page.background_type === 'grid' && (
        <GridPattern opacity={opacity} color={patternColor} patternId={`grid-${page.id}`} />
      )}
{page.background_type === 'custom' && page.background_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.background_image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain pointer-events-none"
          style={{ opacity: customOpacity / 100 }}
        />
      )}

      {/* Grain overlay removed. It was a 4%-opacity SVG turbulence
          filter intended as paper texture, but the feBlend mode=multiply
          step with the rect's default-black SourceGraphic produced a
          perceptible warm/pink cast on pure-white paper in real
          browsers. The print PDF never had this overlay, so removing
          it also brings the live designer in line with what gets
          printed. If we want paper texture back, do it as a CSS
          background-image with a known-neutral PNG. */}

      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  )
}

function GridPattern({
  opacity = 12,
  color = '#000000',
  patternId = 'grid',
}: {
  opacity?: number
  color?: string
  patternId?: string
}) {
  const clampedOpacity = Math.max(10,Math.min(100, opacity)) / 100
  const majorOpacity   = Math.min(1, clampedOpacity * 2.5)
  const minorId = `${patternId}-minor`
  const majorId = `${patternId}-major`

  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={minorId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke={color} strokeWidth="0.35" opacity={clampedOpacity} />
        </pattern>
        <pattern id={majorId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill={`url(#${minorId})`} />
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke={color} strokeWidth="0.8" opacity={majorOpacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${majorId})`} />
    </svg>
  )
}

