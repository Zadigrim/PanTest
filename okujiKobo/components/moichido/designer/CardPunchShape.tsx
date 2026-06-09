'use client'

import { usePassportStore } from '@/lib/design/passport-store'
import { safeUpdate } from '@/lib/design/persist'
import { RingMark } from '@/components/moichido/marks/RingMark'

const RING_DEFAULT = '⭕'

/**
 * Card-level punch shape picker. Cards have ONE punch shape across
 * every punch location, not per-stop — when the merchant changes
 * the shape here, every stop on every page propagates.
 *
 * M4.3 minimum: the default Ring is the heavy-circle emoji which
 * renders identically across kobo / mobile / print PDF. A future
 * pass can add the brand Ring-with-gap SVG to design_assets and
 * wire it through the existing custom_asset path; the data model
 * (stops.stamp_type / stamp_asset_id) already supports it.
 *
 * StampComposer integration for custom shapes is a follow-on. The
 * spec permits ring-only for M4.3 and the existing storage path is
 * forward-compatible.
 */
export function CardPunchShape() {
  const stops = usePassportStore((s) => s.stops)
  const updateStop = usePassportStore((s) => s.updateStop)

  // Use the most-recent stop's icon as the displayed value;
  // propagation guarantees all stops share one shape.
  const current = stops[stops.length - 1]?.stamp_icon ?? RING_DEFAULT

  function setShape(icon: string) {
    // Propagate to every stop in the store + persist each.
    for (const s of stops) {
      updateStop(s.id, { stamp_icon: icon, stamp_type: 'emoji', stamp_asset_id: null })
      void safeUpdate('stops', { stamp_icon: icon, stamp_type: 'emoji', stamp_asset_id: null }, 'id', s.id)
    }
  }

  // Minimal palette for M4.3 — the ring default plus a few obvious
  // alternatives. Custom-via-composer is M4.x follow-on.
  const options: Array<{ value: string; label: string }> = [
    { value: '⭕', label: 'Ring' },
    { value: '●',  label: 'Dot' },
    { value: '★',  label: 'Star' },
    { value: '✓',  label: 'Check' },
    { value: '☕', label: 'Coffee' },
    { value: '🌟', label: 'Sparkle' },
  ]

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-moichido-muted">
        Punch shape
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {options.map((opt) => {
          const isActive = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setShape(opt.value)}
              aria-label={`Use ${opt.label}`}
              title={opt.label}
              className={`flex aspect-square items-center justify-center rounded-card border text-lg transition-colors ${
                isActive
                  ? 'border-moichido-teal bg-moichido-teal/10 text-moichido-teal'
                  : 'border-moichido-hairline bg-white text-moichido-ink hover:bg-moichido-paper'
              }`}
            >
              {opt.value}
            </button>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-moichido-muted">
        <span className="text-moichido-teal"><RingMark size={12} strokeWidth={2.4} /></span>
        One shape per card. New punch locations inherit this.
      </p>
    </div>
  )
}
