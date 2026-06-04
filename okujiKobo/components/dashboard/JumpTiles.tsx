import Link from 'next/link'
import type { OkujiKoboRole } from '@/lib/roles'

/**
 * Compact 6-up jump tiles below the dashboard's working area.
 *
 * Tiles intentionally mirror the app's surfaces — the one-line
 * descriptions act as a legend for what each section is, since the
 * top nav only carries names. My Passports and Program both appear
 * here even though only My Passports lives in the top nav (Program
 * isn't a nav item today; this tile is its discoverability path).
 *
 * GATING is by role only, never by feature maturity. A tile is
 * disabled (reduced opacity, not clickable, "No access" hint) when
 * the signed-in user's roles don't include any role on the tile's
 * `allow` list. Platform admins always see every tile enabled —
 * they bypass the allow list entirely.
 *
 * Layout: 6 across on large screens; wraps to 3×2 on medium and
 * 1×6 on narrow, never shrinking the text below legibility.
 */

interface Tile {
  letter: string
  name: string
  one: string
  href: string
  allow: OkujiKoboRole[]
}

const TILES: Tile[] = [
  {
    letter: 'M',
    name: 'My Passports',
    one: 'Your drafts & published passports',
    href: '/design',
    allow: ['individual_creator', 'institutional_manager', 'designer', 'institutional_employee'],
  },
  {
    letter: 'P',
    name: 'Program',
    one: 'Programs, prizes & collectors',
    href: '/program',
    allow: ['individual_creator', 'institutional_manager'],
  },
  {
    letter: 'A',
    name: 'Assets',
    one: 'Media, emblems & reusable art',
    href: '/assets',
    allow: ['individual_creator', 'institutional_manager', 'designer', 'institutional_employee'],
  },
  {
    letter: 'E',
    name: 'Explore',
    one: 'Published passports from others',
    href: '/explore',
    allow: ['individual_creator', 'institutional_manager', 'designer', 'institutional_employee'],
  },
  {
    letter: 'S',
    name: 'Stop Library',
    one: 'Shared educational stops',
    href: '/stops',
    allow: ['individual_creator', 'institutional_manager', 'designer', 'institutional_employee'],
  },
  {
    letter: 'X',
    name: 'Access',
    one: 'Employee access & verification',
    href: '/access',
    // Mirrors AppNav's canAccessManagement gate so the tile shows
    // for the same audience the top-nav link does.
    allow: ['institutional_manager', 'institutional_employee'],
  },
]

export function JumpTiles({ roles }: { roles: OkujiKoboRole[] }) {
  // Platform admin bypasses the per-tile allow list. Everything
  // enabled, no disabled tiles, no "No access" hints.
  const isAdmin = roles.includes('platform_admin')

  return (
    <section aria-label="Jump to" className="mt-10">
      <h2
        className="mb-3 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        Jump to
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => {
          const enabled = isAdmin || t.allow.some((r) => roles.includes(r))
          return enabled ? <EnabledTile key={t.href} tile={t} /> : <DisabledTile key={t.href} tile={t} />
        })}
      </div>
    </section>
  )
}

function EnabledTile({ tile }: { tile: Tile }) {
  return (
    <Link
      href={tile.href}
      className="group flex items-start gap-3 rounded-[8px] border border-surface-faintdiv bg-surface-rail px-3 py-3 transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      <Letter letter={tile.letter} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">{tile.name}</p>
        <p className="truncate text-[11px] text-muted">{tile.one}</p>
      </div>
    </Link>
  )
}

function DisabledTile({ tile }: { tile: Tile }) {
  return (
    <div
      className="flex items-start gap-3 rounded-[8px] border border-surface-faintdiv bg-surface-rail px-3 py-3 opacity-50"
      aria-disabled="true"
      title="No access for your current role"
    >
      <Letter letter={tile.letter} muted />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">{tile.name}</p>
        <p className="truncate text-[10.5px] text-muted">No access</p>
      </div>
    </div>
  )
}

function Letter({ letter, muted = false }: { letter: string; muted?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-white text-[14px] font-semibold ${
        muted ? 'text-muted' : 'text-ink'
      }`}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}
