import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ASSET_TYPES = ['background', 'stamp', 'cover'] as const
type AssetType = (typeof ASSET_TYPES)[number]

function isAssetType(v: string): v is AssetType {
  return ASSET_TYPES.includes(v as AssetType)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const assetTypeRaw = formData.get('asset_type')
  const name = (formData.get('name') as string | null) ?? null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Upload JPEG, PNG, WebP, GIF, or SVG.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
  }

  const assetType = typeof assetTypeRaw === 'string' ? assetTypeRaw : ''
  if (!isAssetType(assetType)) {
    return NextResponse.json(
      { error: 'asset_type must be one of: background, stamp, cover' },
      { status: 400 },
    )
  }

  // Build a unique storage path
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${user.id}/${assetType}/${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error: uploadErr } = await supabase.storage
    .from('design-assets')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('design-assets')
    .getPublicUrl(storagePath)

  const publicUrl = urlData.publicUrl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asset, error: insertErr } = await (supabase as any)
    .from('design_assets')
    .insert({
      owner_id:     user.id,
      name:         name ?? file.name,
      asset_type:   assetType,
      url:          publicUrl,
      storage_path: storagePath,
    })
    .select('id, name, url, institution_id')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json(asset)
}
