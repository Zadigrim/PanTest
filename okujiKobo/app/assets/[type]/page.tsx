import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'
import { AssetsClient, type ServerAsset } from '@/components/assets/AssetsClient'
import type { ScopeOption } from '@/components/assets/AssetScopeEditor'
import {
  ASSET_TYPE_URL_SLUGS,
  KIND_RULES,
  SLUG_TO_DB,
  isAssetSlug,
  type AssetTypeSlug,
} from '@/lib/assets/kinds'
import { OKUJI_PAGE_BACKGROUNDS } from '@/lib/assets/okuji-presets'

// ─── Top-of-page slim section bar ─────────────────────────────────────────────
//
// Replaces AppNav for this section. The asset library is a creator-workflow
// surface; "Back to designer" is the meaningful primary nav. Wordmark
// matches the canonical "okuji" + small-caps section label pattern used in
// the editor top bar.

function AssetsTopBar() {
  return (
    <header className="border-b border-hairline bg-surface-chrome px-8 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
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
              Assets
            </span>
          </div>
        </div>
        <Link
          href="/design"
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          ← Back to designer
        </Link>
      </div>
    </header>
  )
}

// ─── Segmented tab control ────────────────────────────────────────────────────

function Tabs({ current }: { current: AssetTypeSlug }) {
  return (
    <div
      role="tablist"
      aria-label="Asset type"
      className="mb-6 inline-flex rounded-[8px] border border-surface-faintdiv bg-surface-rail p-1"
    >
      {ASSET_TYPE_URL_SLUGS.map((slug) => {
        const active = current === slug
        const label = KIND_RULES[SLUG_TO_DB[slug]].sectionLabel
        return (
          <Link
            key={slug}
            href={`/assets/${slug}`}
            role="tab"
            aria-selected={active}
            className={cn(
              'rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'border border-hairline bg-white text-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { type: string }
}

export async function generateMetadata({ params }: Props) {
  if (!isAssetSlug(params.type)) return {}
  return { title: `${KIND_RULES[SLUG_TO_DB[params.type]].sectionLabel} — okuji Assets` }
}

export default async function AssetTypePage({ params }: Props) {
  const { type } = params
  if (!isAssetSlug(type)) notFound()

  const dbType = SLUG_TO_DB[type]
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/assets')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Resolve institution membership (drives the "Institution" group's
  // visibility — RLS already lets the user read institution_id rows
  // they have access to, but we use this id to tag rows as "owned"
  // vs "institution" for the source pill on the card).
  const { data: authz } = await db
    .from('employee_authorizations')
    .select('institution_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const userInstitutionId = (authz?.institution_id ?? null) as string | null

  // Query the user's assets of this kind + institution-shared ones.
  // Includes new metadata columns from migration 053 — null on
  // legacy rows; the drawer's meta-line helper handles that.
  const { data: assetRows } = await db
    .from('design_assets')
    .select(
      'id, name, display_name, url, owner_id, institution_id, is_built_in, scoped_passport_id, file_format, bytes_size, width_px, height_px, created_at, scoped_passport:passports!design_assets_scoped_passport_id_fkey(id, title)',
    )
    .eq('asset_type', dbType)
    .or(
      [
        `owner_id.eq.${user.id}`,
        ...(userInstitutionId ? [`institution_id.eq.${userInstitutionId}`] : []),
      ].join(','),
    )
    .order('created_at', { ascending: false })

  type Row = {
    id: string
    name: string | null
    display_name: string | null
    url: string | null
    owner_id: string | null
    institution_id: string | null
    is_built_in: boolean | null
    scoped_passport_id: string | null
    file_format: string | null
    bytes_size: number | null
    width_px: number | null
    height_px: number | null
    created_at: string
    scoped_passport: { id: string; title: string | null } | null
  }
  const rows = (assetRows ?? []) as Row[]

  // Pre-fetch usage counts in one RPC batch so the card can show
  // "{n} ↗" without each tile firing its own /usage round-trip.
  // We call list_asset_references per row — the RPC is cheap and
  // RLS-safe; this keeps the orchestrator's hover-delete UI mirror
  // accurate without a new endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageCounts = new Map<string, number>()
  if (rows.length > 0) {
    await Promise.all(
      rows.map(async (r) => {
        const { data } = await db.rpc('count_asset_references', {
          p_asset_id: r.id,
          p_asset_url: r.url ?? '',
        })
        usageCounts.set(r.id, typeof data === 'number' ? data : 0)
      }),
    )
  }

  // Passports the user can scope assets to.
  const { data: passports } = await db
    .from('passports')
    .select('id, title')
    .order('updated_at', { ascending: false })
  const scopeOptions: ScopeOption[] = ((passports ?? []) as { id: string; title: string | null }[])
    .map((p) => ({ id: p.id, title: p.title ?? 'Untitled' }))

  // Project to ServerAsset shape; classify source.
  const dbAssets: ServerAsset[] = rows.map((a) => {
    const isOwned = a.owner_id === user.id
    const isInstitution =
      !isOwned
      && a.institution_id !== null
      && userInstitutionId !== null
      && a.institution_id === userInstitutionId
    const source: ServerAsset['source'] = isInstitution ? 'institution' : 'owned'
    return {
      id:                  a.id,
      url:                 a.url,
      filename:            a.name,
      displayName:         a.display_name,
      scopedPassportId:    a.scoped_passport_id,
      scopedPassportTitle: a.scoped_passport?.title ?? null,
      source,
      usageCount:          usageCounts.get(a.id) ?? 0,
      widthPx:             a.width_px,
      heightPx:            a.height_px,
      bytesSize:           a.bytes_size,
      fileFormat:          a.file_format,
      createdAt:           a.created_at,
    }
  })

  // Synthetic "Okuji library" presets, surfaced only on the
  // Backgrounds tab. These ship as static files under /public/presets
  // and are NOT design_assets rows. We tag them source='okuji' so
  // the orchestrator hides delete / rename / scope chrome.
  const presetAssets: ServerAsset[] =
    dbType === 'background'
      ? OKUJI_PAGE_BACKGROUNDS.map((p) => ({
          id:                  p.id,
          url:                 p.url,
          filename:            p.url.split('/').pop() ?? null,
          displayName:         p.label,
          scopedPassportId:    null,
          scopedPassportTitle: null,
          source:              'okuji',
          usageCount:          0,
          widthPx:             null,
          heightPx:            null,
          bytesSize:           null,
          fileFormat:          p.format === 'PNG' ? 'image/png' : 'image/svg+xml',
          // Presets sort to the top of "Recently added" regardless,
          // but we still give them a stable timestamp.
          createdAt:           '1970-01-01T00:00:00Z',
        }))
      : []

  const allAssets: ServerAsset[] = [...presetAssets, ...dbAssets]

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AssetsTopBar />

      <main className="mx-auto max-w-6xl px-8 py-8">
        <header className="mb-5">
          <h1 className="text-[25px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Assets
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Your library of {KIND_RULES[dbType].sectionLabel.toLowerCase()} and bundled presets.
          </p>
        </header>

        <Tabs current={type} />

        <AssetsClient kind={dbType} assets={allAssets} scopeOptions={scopeOptions} />
      </main>
    </div>
  )
}
