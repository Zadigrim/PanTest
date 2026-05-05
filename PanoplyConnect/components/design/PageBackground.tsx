'use client'

import { GuillochePattern } from './GuillochePattern'
import type { DesignerPassportPage } from '@/lib/design/types'

interface Props {
  page: DesignerPassportPage
  children?: React.ReactNode
}

/** Three-layer background: paper color → guilloche SVG → grain texture. */
export function PageBackground({ page, children }: Props) {
  const paper = `#${page.paper_color ?? 'F5F2EC'}`
  const patternColor = `#${page.background_color ?? '0D1B2A'}`

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: paper }}
    >
      {/* Layer 2: Guilloche (only when background_type is 'guilloche') */}
      {page.background_type === 'guilloche' && (
        <GuillochePattern
          opacity={page.background_opacity ?? 12}
          color={patternColor}
          patternId={`guilloche-${page.id}`}
        />
      )}

      {/* Layer 3: Grain texture via SVG noise */}
      <GrainOverlay />

      {/* Page content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
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
