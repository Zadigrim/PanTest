import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewPassportButton } from '@/components/design/NewPassportButton'
import { PrintPassportButton } from '@/components/design/PrintPassportButton'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import type { DesignerPassport, CoverSideData } from '@/lib/design/types'

export const metadata = { title: 'My Passports — PanoplyDesigner' }

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-panoply-gray-2 text-panoply-gray-3',
  published: 'bg-panoply-teal-lt text-panoply-teal-dk',
  archived:  'bg-panoply-amber/15 text-panoply-amber',
}

function defaultThumbnailSvg(title: string): string {
  const safe = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  // Wrap title at ~20 chars
  const words = safe.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length > 20 && current) {
      lines.push(current.trim())
      current = w
    } else {
      current = (current + ' ' + w).trim()
    }
  }
  if (current) lines.push(current.trim())
  const titleLines = lines.slice(0, 2)

  const titleY1 = 248
  const titleY2 = 262
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="392" viewBox="0 0 280 392">
  <rect width="280" height="392" fill="#0D1B2A"/>
  <circle cx="140" cy="180" r="170" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="180" r="130" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="180" r="90"  fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="180" r="50"  fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <text x="140" y="70" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="6" fill="#1D9E75">PANOPLY</text>
  <text x="140" y="210" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" letter-spacing="8" fill="white">PASSPORT</text>
  ${titleLines[0] ? `<text x="140" y="${titleY1}" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${titleLines[0]}</text>` : ''}
  ${titleLines[1] ? `<text x="140" y="${titleY2}" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${titleLines[1]}</text>` : ''}
  <line x1="40" y1="350" x2="240" y2="350" stroke="#1D9E75" stroke-width="1" opacity="0.3"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function CoverThumbnail({ passport }: { passport: DesignerPassport }) {
  // If cover has been designed, show the front panel bg + image
  const outside = passport.cover_outside_data as CoverSideData | null
  const hasDesignedCover = outside && (outside.image_url || outside.front_bg !== '0D1B2A')
  const frontBg = outside?.front_bg ?? passport.cover_bg_color ?? '0D1B2A'
  const imageUrl = outside?.image_url ?? null
  const imageOpacity = outside?.image_opacity ?? 80

  if (hasDesignedCover) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-t-panel"
        style={{ height: 140, backgroundColor: `#${frontBg}` }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: imageOpacity / 100 }}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="text-3xl">{passport.cover_emblem ?? '🧭'}</span>
        </div>
      </div>
    )
  }

  // Default SVG thumbnail
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={defaultThumbnailSvg(passport.title)}
      alt={`${passport.title} cover`}
      className="w-full rounded-t-panel object-cover"
      style={{ height: 140 }}
    />
  )
}

function PassportCard({ passport }: { passport: DesignerPassport }) {
  const isInstitutional = Boolean(passport.institution_id ?? passport.proprietor_id)
  return (
    <div className="rounded-panel border border-panoply-gray-2 bg-white transition-shadow hover:shadow-md overflow-hidden">
      {/* Cover thumbnail */}
      <Link href={`/design/${passport.id}`} className="block">
        <CoverThumbnail passport={passport} />
      </Link>

      <Link href={`/design/${passport.id}`} className="group block px-5 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-panoply-navy group-hover:text-panoply-teal-dk transition-colors truncate">
            {passport.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[passport.status ?? 'draft']
            }`}
          >
            {passport.status ?? 'draft'}
          </span>
        </div>

        {passport.description && (
          <p className="mt-1 text-sm text-panoply-gray-3 line-clamp-2">
            {passport.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-panoply-gray-3">
          <span>{spendTierLabel(passport.expected_spend_tier)}</span>
          {passport.transit_accessible && <span title="Transit accessible">🚌</span>}
          {passport.wheelchair_accessible && <span title="Wheelchair accessible">♿</span>}
        </div>

        <div className="mt-1 text-xs text-panoply-gray-3">
          Updated {new Date(passport.updated_at).toLocaleDateString()}
        </div>
      </Link>

      {isInstitutional && passport.print_enabled && (
        <div className="border-t border-panoply-gray-2 px-5 pb-4 pt-3">
          <PrintPassportButton
            passport={{
              id: passport.id,
              title: passport.title,
              institution_id: passport.institution_id ?? passport.proprietor_id ?? '',
              print_journal_setting: passport.print_journal_setting ?? 'include_all',
            }}
          />
        </div>
      )}
    </div>
  )
}

export default async function DesignIndexPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: passports } = await supabase
    .from('passports')
    .select('*')
    .eq('creator_id', user.id)
    .order('updated_at', { ascending: false })

  const list = (passports ?? []) as DesignerPassport[]

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      {/* Top bar */}
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧭</span>
            <span className="font-serif text-xl font-bold text-panoply-navy tracking-wide">
              PanoplyDesigner
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            ← Back to Panoply
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-panoply-navy">My Passports</h1>
            <p className="mt-1 text-sm text-panoply-gray-3">
              {list.length === 0
                ? 'Create your first passport to get started.'
                : `${list.length} passport${list.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {/* NewPassportButton links to /design/new for the creation flow */}
          <NewPassportButton userId={user.id} />
        </div>

        {/* Empty state */}
        {list.length === 0 && (
          <div className="rounded-modal border-2 border-dashed border-panoply-gray-2 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-panoply-teal-lt text-3xl">
              🗺
            </div>
            <h2 className="text-lg font-semibold text-panoply-navy">No passports yet</h2>
            <p className="mt-2 text-sm text-panoply-gray-3">
              Create your first passport to start building experiences.
            </p>
            <div className="mt-6">
              <NewPassportButton userId={user.id} />
            </div>
          </div>
        )}

        {/* Passport grid */}
        {list.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <PassportCard key={p.id} passport={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
