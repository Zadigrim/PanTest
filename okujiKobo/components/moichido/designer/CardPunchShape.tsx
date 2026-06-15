'use client'

import { useState } from 'react'
import { usePassportStore } from '@/lib/design/passport-store'
import { StampComposer } from '@/components/design/StampComposer'
import { StampPreview } from '@/components/design/StampPreview'
import { RingMark } from '@/components/moichido/marks/RingMark'

const RING_DEFAULT = '⭕'
const PUNCH_INK = '0F4C5C' // moichido teal, hex without # (StampPreview adds it)

/**
 * Card-level punch mark. A card has ONE mark across every punch slot (not
 * per-slot), so it lives on the passport (punch_type / punch_icon /
 * punch_asset_id, migration 086) and the canvas renders it in every PunchBox.
 *
 * Two ways to set it:
 *   - the emoji palette (punch_type='emoji'), or
 *   - "Design a custom punch", which reuses the StampComposer to compose an
 *     SVG mark saved to design_assets, then sets punch_type='custom_asset' +
 *     punch_asset_id.
 */
export function CardPunchShape() {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)
  const [composerOpen, setComposerOpen] = useState(false)

  const punchType = passport?.punch_type ?? 'emoji'
  const punchIcon = passport?.punch_icon ?? RING_DEFAULT
  const punchAssetId = passport?.punch_asset_id ?? null
  const isCustom = punchType === 'custom_asset' && !!punchAssetId

  function setEmoji(icon: string) {
    updatePassport({ punch_type: 'emoji', punch_icon: icon, punch_asset_id: null })
  }

  // Minimal emoji palette — the ring default plus a few obvious alternatives.
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
        Punch mark
      </p>

      <div className="grid grid-cols-6 gap-1.5">
        {options.map((opt) => {
          const isActive = !isCustom && punchIcon === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEmoji(opt.value)}
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

      {/* Custom mark — design via the reused StampComposer. */}
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        disabled={!passport}
        className={`flex w-full items-center gap-2 rounded-card border px-2.5 py-2 text-left text-xs transition-colors ${
          isCustom
            ? 'border-moichido-teal bg-moichido-teal/10'
            : 'border-moichido-hairline bg-white hover:bg-moichido-paper'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-moichido-hairline bg-white">
          {isCustom ? (
            <StampPreview assetId={punchAssetId} color={PUNCH_INK} size={22} />
          ) : (
            <span className="text-moichido-teal"><RingMark size={14} strokeWidth={2.4} /></span>
          )}
        </span>
        <span className="text-moichido-ink">
          {isCustom ? 'Custom punch — edit / replace' : 'Design a custom punch…'}
        </span>
      </button>

      <p className="flex items-center gap-1.5 text-[11px] text-moichido-muted">
        <span className="text-moichido-teal"><RingMark size={12} strokeWidth={2.4} /></span>
        One mark per card. Every punch slot uses it.
      </p>

      {passport && (
        <StampComposer
          mode="designer"
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          currentPassportId={passport.id}
          onSaved={({ id }) => {
            updatePassport({ punch_type: 'custom_asset', punch_asset_id: id })
            setComposerOpen(false)
          }}
        />
      )}
    </div>
  )
}
