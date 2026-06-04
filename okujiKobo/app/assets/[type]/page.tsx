import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'
import { UploadAssetButton } from '@/components/assets/UploadAssetButton'
import { DeleteAssetButton } from '@/components/assets/DeleteAssetButton'
import { AssetUsageExpander } from '@/components/assets/AssetUsageExpander'
import { AssetScopeEditor, type ScopeOption } from '@/components/assets/AssetScopeEditor'

// ---------------------------------------------------------------------------
// Config per asset type
// ---------------------------------------------------------------------------

const ASSET_TYPES = ['backgrounds', 'stamps', 'covers'] as const
type AssetType = (typeof ASSET_TYPES)[number]

const TYPE_META: Record<
  AssetType,
  {
    label: string
    emptyHeading: string
    emptyBody: string
    dbType: string
  }
> = {
  backgrounds: {
    label: 'Backgrounds',
    dbType: 'background',
    emptyHeading: 'No custom backgrounds yet.',
    emptyBody: 'Backgrounds set the mood for your passport pages.',
  },
  stamps: {
    label: 'Stamps',
    dbType: 'stamp',
    emptyHeading: 'No custom stamps yet.',
    emptyBody: 'Stamps are the visual moments collectors earn.',
  },
  covers: {
    label: 'Covers',
    dbType: 'cover',
    emptyHeading: 'No custom covers yet.',
    emptyBody: 'Cover images appear at the top of your passport in the marketplace.',
  },
}

function isAssetType(value: string): value is AssetType {
  return ASSET_TYPES.includes(value as AssetType)
}

// ---------------------------------------------------------------------------
// Tab nav
// ---------------------------------------------------------------------------

function TabNav({ current }: { current: AssetType }) {
  return (
    <nav
      className="flex gap-0.5 border-b border-hairline mb-8"
      aria-label="Asset type tabs"
    >
      {ASSET_TYPES.map((type) => (
        <Link
          key={type}
          href={`/assets/${type}`}
          className={cn(
            'px-5 py-2.5 text-sm font-medium rounded-t-panel transition-colors -mb-px',
            current === type
              ? 'bg-white border border-b-white border-hairline text-navy'
              : 'text-muted hover:text-navy',
          )}
          aria-current={current === type ? 'page' : undefined}
        >
          {TYPE_META[type].label}
        </Link>
      ))}
    </nav>
  )
}


// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string
  name: string | null
  url: string | null
  institution_id: string | null
  owner_id: string | null
  is_built_in: boolean | null
  scoped_passport_id: string | null
  // Joined passport title (when scoped). Comes back as an object from
  // PostgREST FK-embed; we flatten it server-side before the prop hop.
  scoped_passport_title: string | null
}

function AssetCard({
  asset,
  userInstitutionId,
  currentUserId,
  scopeOptions,
}: {
  asset: AssetRow
  userInstitutionId: string | null
  currentUserId: string
  scopeOptions: ScopeOption[]
}) {
  const isShared =
    asset.institution_id !== null &&
    userInstitutionId !== null &&
    asset.institution_id === userInstitutionId

  const canDelete = asset.is_built_in !== true && asset.owner_id === currentUserId

  return (
    <div className="bg-white rounded-panel border border-hairline overflow-hidden group">
      {/* Preview area */}
      <div className="aspect-video bg-paper flex items-center justify-center">
        {asset.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name ?? 'Asset preview'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl text-hairline" aria-hidden="true">
            🖼
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy truncate">
          {asset.name ?? 'Untitled'}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {isShared && (
            <span className="inline-flex items-center rounded-card bg-cream px-2 py-0.5 text-xs font-medium text-green">
              Shared
            </span>
          )}
          <DeleteAssetButton
            assetId={asset.id}
            assetName={asset.name ?? 'Untitled'}
            canDelete={canDelete}
          />
        </div>
      </div>
      {canDelete && (
        <AssetScopeEditor
          assetId={asset.id}
          initialScopedPassportId={asset.scoped_passport_id}
          initialScopedPassportTitle={asset.scoped_passport_title}
          options={scopeOptions}
        />
      )}
      {canDelete && <AssetUsageExpander assetId={asset.id} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ meta }: { meta: (typeof TYPE_META)[AssetType] }) {
  return (
    <div className="rounded-modal border-2 border-dashed border-hairline py-20 text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-paper text-3xl"
        aria-hidden="true"
      >
        🖼
      </div>
      <h2 className="text-base font-semibold text-navy">{meta.emptyHeading}</h2>
      <p className="mt-2 text-sm text-muted max-w-xs mx-auto">{meta.emptyBody}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: { type: string }
}

export async function generateMetadata({ params }: Props) {
  const type = params.type
  if (!isAssetType(type)) return {}
  return { title: `${TYPE_META[type].label} — okujiKobo Assets` }
}

export default async function AssetTypePage({ params }: Props) {
  const { type } = params

  if (!isAssetType(type)) notFound()

  const meta = TYPE_META[type]
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/assets')

  // Resolve user's institution (if any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authz } = await (supabase as any)
    .from('employee_authorizations')
    .select('institution_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle() as { data: { institution_id: string } | null }

  const userInstitutionId = authz?.institution_id ?? null

  // Query design_assets — table may not exist yet; treat any error as empty.
  // FK-embed scoped_passport so we can show "scoped to {title}" without
  // a second query per row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: assets, error: assetsError } = await db
    .from('design_assets')
    .select('id, name, url, institution_id, owner_id, is_built_in, scoped_passport_id, scoped_passport:passports!design_assets_scoped_passport_id_fkey(id, title)')
    .eq('asset_type', meta.dbType)
    .or(
      [
        `owner_id.eq.${user.id}`,
        ...(userInstitutionId ? [`institution_id.eq.${userInstitutionId}`] : []),
      ].join(','),
    )
    .order('created_at', { ascending: false })

  if (assetsError) {
    console.error('design_assets query error:', assetsError)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetList: AssetRow[] = ((assets ?? []) as any[]).map((a) => ({
    id:                     a.id,
    name:                   a.name,
    url:                    a.url,
    institution_id:         a.institution_id,
    owner_id:               a.owner_id,
    is_built_in:            a.is_built_in,
    scoped_passport_id:     a.scoped_passport_id,
    scoped_passport_title:  a.scoped_passport?.title ?? null,
  }))

  // Passports the user can scope assets to. Same RLS as the upload
  // route uses for validation, so anything we list here is acceptable
  // to the PATCH endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: passports } = await (supabase as any)
    .from('passports')
    .select('id, title')
    .order('updated_at', { ascending: false })
  const scopeOptions: ScopeOption[] = ((passports ?? []) as { id: string; title: string | null }[])
    .map((p) => ({ id: p.id, title: p.title ?? 'Untitled' }))

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="border-b border-hairline bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-navy">Assets</span>
          </div>
          <Link
            href="/design"
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            ← Back to designer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <TabNav current={type} />

        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-navy">{meta.label}</h2>
            <p className="text-sm text-muted mt-0.5">
              {assetList.length === 0
                ? 'No assets yet.'
                : `${assetList.length} asset${assetList.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <UploadAssetButton assetType={meta.dbType as 'background' | 'stamp' | 'cover'} />
        </div>

        {assetList.length === 0 ? (
          <EmptyState meta={meta} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {assetList.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                userInstitutionId={userInstitutionId}
                currentUserId={user.id}
                scopeOptions={scopeOptions}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
