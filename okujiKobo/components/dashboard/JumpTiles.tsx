import Link from 'next/link'

/**
 * Compact 4-up jump tiles. Replaces the prior large nav-card grid
 * that duplicated the top nav. My Passports lives in the nav and is
 * not surfaced here; Program is intentionally absent (no such
 * feature today — see DASHBOARD_REVIEW.md).
 */

interface Tile {
  letter: string
  name: string
  one: string
  href: string
}

const TILES: Tile[] = [
  { letter: 'A', name: 'Assets',       one: 'Media, emblems & reusable art',          href: '/assets'  },
  { letter: 'E', name: 'Explore',      one: 'Published passports from others',        href: '/explore' },
  { letter: 'S', name: 'Stop Library', one: 'Shared educational stops',               href: '/stops'   },
  { letter: 'X', name: 'Access',       one: 'Employee access & verification',         href: '/access'  },
]

export function JumpTiles() {
  return (
    <section aria-label="Jump to" className="mt-10">
      <h2
        className="mb-3 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        Jump to
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-center gap-3 rounded-[8px] border border-surface-faintdiv bg-surface-rail px-3 py-3 transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-white text-[14px] font-semibold text-ink"
              aria-hidden="true"
            >
              {t.letter}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{t.name}</p>
              <p className="truncate text-[11px] text-muted">{t.one}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
