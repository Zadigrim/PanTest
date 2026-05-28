import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const assetId = params.id
  if (!assetId) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 })
  }

  // Fetch the asset via service-role so we can check ownership/built-in
  // regardless of RLS visibility differences.
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asset, error: fetchErr } = await (service as any)
    .from('design_assets')
    .select('id, owner_id, asset_type, url, storage_path, is_built_in')
    .eq('id', assetId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!asset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (asset.is_built_in === true) {
    return NextResponse.json(
      { error: 'Built-in assets cannot be deleted' },
      { status: 403 },
    )
  }

  // Admin bypass via is_platform_admin RPC; otherwise must be owner.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  const isAdmin = isAdminRpc === true

  if (!isAdmin && asset.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // ── Usage check (service-role; sees all drafts across all users) ───────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refCount, error: rpcErr } = await (service as any).rpc(
    'count_asset_references',
    { p_asset_id: asset.id, p_asset_url: asset.url ?? '' },
  )

  if (rpcErr) {
    console.error('count_asset_references error:', rpcErr)
    return NextResponse.json(
      { error: 'Could not verify asset usage; aborting delete' },
      { status: 500 },
    )
  }

  const count = typeof refCount === 'number' ? refCount : 0
  if (count > 0) {
    return NextResponse.json(
      {
        error: 'Asset is in use',
        in_use_count: count,
        message: `This asset is used in ${count} place${count === 1 ? '' : 's'}. Remove it from those passports before deleting.`,
      },
      { status: 409 },
    )
  }

  // ── Two-step delete: storage first, then DB row ────────────────────────────
  // If storage fails, we abort before touching the row — no orphan record.
  // If storage succeeds but DB delete fails, the file is gone but the row
  // remains; the user can retry, and a re-delete will find storage already
  // empty (we ignore "not found" on storage retry).
  if (asset.storage_path) {
    const { error: storageErr } = await service.storage
      .from('design-assets')
      .remove([asset.storage_path])
    if (storageErr) {
      console.error('asset storage delete failed:', storageErr)
      return NextResponse.json(
        { error: 'Failed to remove file from storage; row not deleted' },
        { status: 500 },
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (service as any)
    .from('design_assets')
    .delete()
    .eq('id', asset.id)

  if (dbErr) {
    console.error('asset DB delete failed (storage already removed):', dbErr)
    return NextResponse.json(
      { error: 'File removed but database row delete failed; please retry' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
