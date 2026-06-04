import Image from 'next/image'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewPassportButton } from '@/components/design/NewPassportButton'
import { PrintPassportButton } from '@/components/design/PrintPassportButton'
import { PassportCoverThumbnail } from '@/components/design/PassportCoverThumbnail'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import { passportTypeIconFromClassifiers } from '@/lib/design/passport-type-icon'
import type { DesignerPassport, CoverSideData } from '@/lib/design/types'

export const metadata = { title: 'My Passports — OkujiDesigner' }

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-hairline text-muted',
  published: 'bg-cream text-green',
  archived:  'bg-accent/15 text-accent',
}

// ── Cover thumbnail — 2:3 proportions, full card width ───────────────────────

function CoverThumbnail({ passport }: { passport: DesignerPassport }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classifiers = (passport as any).classifiers as string[] | null | undefined
  const typeIcon = passportTypeIconFromClassifiers(classifiers)

  return (
    <PassportCoverThumbnail
      title={passport.title}
      typeIcon={typeIcon}
      outsideData={passport.cover_outside_data as CoverSideData | null}
      coverImageUrl={passport.cover_image_url ?? null}
      coverThumbnail={passport.cover_thumbnail ?? null}
      fallbackBg={passport.cover_bg_color ?? '0D1B2A'}
    />
  )
}

// ── Passport card ─────────────────────────────────────────────────────────────

function PassportCard({ passport }: { passport: DesignerPassport }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-panel border border-hairline bg-white transition-shadow hover:shadow-md">
      {/* Cover thumbnail — full width, no padding, 2:3 ratio */}
      <Link href={`/design/${passport.id}`} className="block">
        <CoverThumbnail passport={passport} />
      </Link>

      {/* Info section — stretches to fill card height */}
      <Link href={`/design/${passport.id}`} className="group flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-navy group-hover:text-green transition-colors line-clamp-2 leading-snug">
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
          <p className="text-sm text-muted line-clamp-2 leading-snug">
            {passport.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted pt-1">
          <span>{spendTierLabel(passport.expected_spend_tier)}</span>
          {passport.transit_accessible && <span title="Transit accessible">🚌</span>}
          {passport.wheelchair_accessible && <span title="Wheelchair accessible">♿</span>}
        </div>

        <p className="text-xs text-muted">
          Updated {new Date(passport.updated_at).toLocaleDateString()}
        </p>
      </Link>

      {/* Card footer — always visible, print button lower-left */}
      <div className="border-t border-hairline px-3 py-2 flex items-center">
        <PrintPassportButton
          compact
          passport={{
            id: passport.id,
            title: passport.title,
            institution_id: passport.institution_id ?? passport.proprietor_id ?? null,
          }}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="border-b border-hairline bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/appicon/png-rounded/okuji-icon-rounded-180.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-[7px]"
              aria-hidden="true"
            />
            <span className="font-serif text-xl font-bold text-navy tracking-wide">
              OkujiDesigner
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            ← Back to Okuji
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">My Passports</h1>
            <p className="mt-1 text-sm text-muted">
              {list.length === 0
                ? 'Create your first passport to get started.'
                : `${list.length} passport${list.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <NewPassportButton userId={user.id} />
        </div>

        {list.length === 0 && (
          <div className="rounded-modal border-2 border-dashed border-hairline py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream text-3xl">
              🗺
            </div>
            <h2 className="text-lg font-semibold text-navy">No passports yet</h2>
            <p className="mt-2 text-sm text-muted">
              Create your first passport to start building experiences.
            </p>
            <div className="mt-6">
              <NewPassportButton userId={user.id} />
            </div>
          </div>
        )}

        {/* 4 columns on desktop (≥1280px), 2 on tablet */}
        {list.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((p) => (
              <PassportCard key={p.id} passport={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
