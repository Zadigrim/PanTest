'use client'

import { IconTile } from './IconTile'
import type { StopCardData } from './types'

/**
 * One library stop in card form. ~3-col grid on desktop.
 *
 *   1. Icon tile + title + place line (Location) or
 *      activity line (Event/Activity — never a fake address).
 *   2. Tag row: subject chip (blue) + grade chip. Time chip
 *      omitted entirely — schema has no time field.
 *   3. One-line description (learning objective, truncated).
 *   4. Footer: attribution + acknowledgments count · Preview · Import.
 */
export function StopCard({
  stop,
  highlighted,
  onPreview,
  onImport,
}: {
  stop: StopCardData
  highlighted: boolean
  onPreview: () => void
  onImport: () => void
}) {
  return (
    <article
      className={`flex flex-col rounded-[10px] border-[1.5px] bg-white p-3.5 transition-colors ${
        highlighted ? 'border-ink' : 'border-hairline hover:border-ink/40'
      }`}
    >
      {/* Head: icon + title + place line */}
      <div className="flex items-start gap-3">
        <IconTile classifiers={stop.classifiers} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-ink">{stop.name}</h3>
          <PlaceLine stop={stop} />
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SubjectChip subjects={stop.subject_areas} />
        <GradeChip grades={stop.grade_levels} />
      </div>

      {/* Description */}
      {stop.learning_objective && (
        <p className="mt-3 line-clamp-2 text-[12.5px] text-muted">
          {stop.learning_objective}
        </p>
      )}

      <div className="mt-3 flex-1" />

      {/* Footer */}
      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-surface-faintdiv pt-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted">
            Built by{' '}
            <span className="font-semibold text-ink">{stop.creator_name ?? 'someone'}</span>
            {stop.institution_name && (
              <> · <span className="text-ink">{stop.institution_name}</span></>
            )}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-muted">
            <KudosGlyph />
            {stop.acknowledgment_count > 0
              ? `${stop.acknowledgment_count} acknowledgment${stop.acknowledgment_count === 1 ? '' : 's'}`
              : 'No acknowledgments yet'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onPreview}
            className="rounded-[6px] border-[1.5px] border-hairline bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={onImport}
            className="rounded-[6px] border-[1.5px] border-ink bg-green px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-green/90"
          >
            Import
          </button>
        </div>
      </footer>
    </article>
  )
}

// ── Place / activity line ──
function PlaceLine({ stop }: { stop: StopCardData }) {
  if (stop.experience_type === 'experience') {
    return (
      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11.5px] text-muted">
        <ActivityGlyph />
        <span>Event / activity</span>
      </p>
    )
  }
  // Location (default). Show only what's actually present —
  // never invent an address.
  const parts = [stop.address_city, stop.address_state].filter(Boolean) as string[]
  return (
    <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11.5px] text-muted">
      <PinGlyph />
      {parts.length > 0 ? <span>{parts.join(', ')}</span> : <span className="italic">Location TBA</span>}
    </p>
  )
}

// ── Chips ──
function SubjectChip({ subjects }: { subjects: string[] }) {
  if (subjects.length === 0) return null
  return (
    <span className="inline-flex items-center rounded-full border-[1.5px] border-blue bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-blue">
      {humanizeSchemaValue(subjects[0])}
    </span>
  )
}
function GradeChip({ grades }: { grades: string[] }) {
  if (grades.length === 0) return null
  const label = grades.length === 1 ? grades[0] : `${grades[0]} +${grades.length - 1}`
  return (
    <span className="inline-flex items-center rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-ink">
      {label.replace('-', '–')}
    </span>
  )
}

function humanizeSchemaValue(v: string): string {
  return v.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Inline line-icon glyphs (no emoji) ──
function PinGlyph() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx={12} cy={10} r={3} />
    </svg>
  )
}
function ActivityGlyph() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx={12} cy={12} r={10} /><path d="M8 12l3 3 5-6" />
    </svg>
  )
}
function KudosGlyph() {
  // A two-line check-burst — neutral kudos motif, not a heart
  // or thumb so it reads as "acknowledged" not "liked".
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12l2 2 4-4" /><circle cx={12} cy={12} r={9} />
    </svg>
  )
}
