'use client'

import { PageBackground } from '@/components/design/PageBackground'
import type { BackgroundType, DesignerPageElement } from '@/lib/design/types'
import { ReadOnlyElement, ReadOnlyStop, type ViewerStop } from './ReadOnlyElements'

// Read-only page shape: every field the viewer needs, with nullability
// matching the DB rows. Standalone (does NOT extend DesignerPassportPage)
// so we don't need to fetch fields that nothing visible reads
// (passport_id, page_number, created_at).
export interface ViewerPage {
  id: string
  page_order: number
  page_type: 'stamp' | 'information'
  section_name: string
  section_title: string | null
  section_subtitle: string | null
  prize_description: string | null
  prize_location_constraint: string | null
  paper_color: string | null
  background_type: BackgroundType
  background_color: string | null
  background_opacity: number | null
  background_image_url: string | null
  custom_background_opacity: number | null
  elements: DesignerPageElement[]
  stops: ViewerStop[]
}

// 612×792 design-unit page. Render at intrinsic size; the viewer
// applies CSS transform: scale to fit available width.
const PAGE_W = 612
const PAGE_H = 792

interface Props {
  page: ViewerPage | null
}

/** Renders one design-unit page using the same background tree as the
 *  designer, with non-interactive renderers for stops and elements. */
export function PageView({ page }: Props) {
  if (!page) {
    // Last spread on an odd page count: render an empty paper slot so
    // the spread still reads as a 2-page book opening.
    return (
      <div
        className="relative bg-paper shadow-lg"
        style={{ width: PAGE_W, height: PAGE_H }}
      />
    )
  }

  return (
    <div
      className="relative overflow-hidden shadow-lg"
      style={{ width: PAGE_W, height: PAGE_H }}
    >
      <PageBackground page={page}>
        {/* Page elements (text, image, lines) — below stops. */}
        {(page.elements ?? []).map((el) => (
          <ReadOnlyElement key={el.id} element={el} />
        ))}
        {/* Stop boxes — the visual layout the creator arranged. */}
        {page.stops.map((stop) => (
          <ReadOnlyStop key={stop.id} stop={stop} />
        ))}
      </PageBackground>
    </div>
  )
}

export { PAGE_W, PAGE_H }
