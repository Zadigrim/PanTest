import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

// Returns the passports that reference a design_assets row, grouped by passport,
// with the kinds of reference (cover image, page background, etc.). Powers the
// "Used in N passports" expander on the /assets management page and the
// designer's delete-asset affordances so the user can navigate to the
// passports using an asset before deleting.

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  )
}

interface ReferenceRow {
  passport_id: string
  passport_title: string
  reference_kind: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service-role to see refs across all drafts (asset usage is global state;
  // the auth check upstream protects whose asset metadata is being looked at).
  const service = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asset, error: lookupErr } = await (service as any)
    .from('design_assets')
    .select('id, url, owner_id')
    .eq('id', params.id)
    .single()

  if (lookupErr || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  const isAdmin = isAdminRpc === true
  if (!isAdmin && asset.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refs, error: rpcErr } = await (service as any).rpc(
    'list_asset_references',
    { p_asset_id: asset.id, p_asset_url: asset.url ?? '' },
  )

  if (rpcErr) {
    console.error('list_asset_references error:', rpcErr)
    return NextResponse.json({ error: 'Could not list asset usage' }, { status: 500 })
  }

  const rows = (refs ?? []) as ReferenceRow[]

  // Group by passport so the UI can show one row per passport with the kinds.
  const byPassport = new Map<string, { passport_id: string; passport_title: string; kinds: string[] }>()
  for (const r of rows) {
    const existing = byPassport.get(r.passport_id)
    if (existing) {
      if (!existing.kinds.includes(r.reference_kind)) existing.kinds.push(r.reference_kind)
    } else {
      byPassport.set(r.passport_id, {
        passport_id: r.passport_id,
        passport_title: r.passport_title,
        kinds: [r.reference_kind],
      })
    }
  }

  const passports = Array.from(byPassport.values())
  return NextResponse.json({ passports, total: rows.length })
}
