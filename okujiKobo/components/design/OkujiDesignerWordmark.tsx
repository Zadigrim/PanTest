import Image from 'next/image'

/**
 * Okuji Kōbō wordmark for the designer top bar.
 *
 * Two pieces, side-by-side:
 *   - The rounded "o." app-icon tile (workspace bg, ink hairline, radius 8)
 *   - The wordmark itself: lowercase "okuji" (Inter 500, tracked tight) +
 *     small-caps "DESIGNER" label (11px, tracked 3px, muted)
 *
 * The wordmark is always lowercase "okuji" — never "Okuji" / "OkujiDesigner".
 * Pre-redesign that capitalised serif wordmark lived in three places; this
 * component centralises the canonical lockup so they stay in sync.
 */
export function OkujiDesignerWordmark() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/appicon/png-rounded/okuji-icon-rounded-180.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-[8px] border-[1.5px] border-ink bg-surface-workspace"
        aria-hidden="true"
      />
      <div className="flex items-baseline gap-2">
        <span
          className="text-[18px] font-medium text-ink"
          style={{ letterSpacing: '-0.02em', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
        >
          okuji
        </span>
        <span
          className="text-[11px] font-medium uppercase text-muted"
          style={{ letterSpacing: '3px' }}
        >
          Designer
        </span>
      </div>
    </div>
  )
}
