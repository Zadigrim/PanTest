'use client'

import { GuillochePattern } from './GuillochePattern'
import type { DesignerPassportPage } from '@/lib/design/types'

interface Props {
  page: DesignerPassportPage
  children?: React.ReactNode
}

/** Three-layer background: paper color → pattern/image → grain texture. */
export function PageBackground({ page, children }: Props) {
  const paper = `#${page.paper_color ?? 'F5F2EC'}`
  const patternColor = `#${page.background_color ?? '0D1B2A'}`
  const opacity = Math.min(12, Math.max(8, page.background_opacity ?? 10))

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
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}

      {/* Grain texture */}
      <GrainOverlay />

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
  const clampedOpacity = Math.max(8, Math.min(20, opacity)) / 100
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

function GrainOverlay() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none z-[1]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="grain-filter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feBlend in="SourceGraphic" mode="multiply" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)" opacity="0.04" />
    </svg>
  )
}
