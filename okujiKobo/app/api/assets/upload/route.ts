import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// Custodial account — owns the built-in okuji library assets. Uploading
// "as custodial" is the asset-library account switcher; gated to platform
// admins server-side (never trust the client flag).
const CUSTODIAL_ID = '00000000-0000-0000-0000-000000000001'

const ASSET_TYPES = ['background', 'stamp', 'cover', 'layout'] as const
type AssetType = (typeof ASSET_TYPES)[number]

function isAssetType(v: string): v is AssetType {
  return ASSET_TYPES.includes(v as AssetType)
}

// ── Monochrome detection ──────────────────────────────────────────────────────

function detectSvgMonochrome(svgText: string): boolean {
  // Extract all fill and stroke color values
  const colorRe = /(?:fill|stroke)="([^"]+)"/g
  const colors = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = colorRe.exec(svgText)) !== null) {
    const c = match[1].toLowerCase()
    if (c === 'none' || c === 'transparent') continue
    // Normalise black variants
    const normalised = (c === 'black' || c === '#000') ? '#000000' : c
    colors.add(normalised)
  }
  return colors.size <= 1
}

async function detectMonochrome(
  buffer: Buffer,
  mimeType: string,
): Promise<boolean | null> {
  try {
    if (mimeType === 'image/svg+xml') {
      const text = buffer.toString('utf-8')
      return detectSvgMonochrome(text)
    }
    // For raster images attempt canvas-based detection via Jimp if available.
    // If Jimp is not installed, return null (unknown).
    try {
      // webpackIgnore prevents webpack from trying to bundle/resolve jimp at
      // build time; Node.js resolves it at runtime, catch handles missing pkg.
      const Jimp = (await import(/* webpackIgnore: true */ 'jimp').catch(() => null))
      if (!Jimp) return null

      // Jimp 1.x uses Jimp.fromBuffer; older uses Jimp.read
      const image = await (Jimp as any).fromBuffer(buffer).catch(() => (Jimp as any).read(buffer))
      const resized = image.resize(50, 50)
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      resized.scan(0, 0, resized.bitmap.width, resized.bitmap.height,
        (_x: number, _y: number, idx: number) => {
          const a = resized.bitmap.data[idx + 3]
          if (a < 128) return // skip transparent
          rSum += resized.bitmap.data[idx]
          gSum += resized.bitmap.data[idx + 1]
          bSum += resized.bitmap.data[idx + 2]
          count++
        }
      )
      if (count === 0) return null
      const rMean = rSum / count
      const gMean = gSum / count
      const bMean = bSum / count
      const maxDiff = Math.max(
        Math.abs(rMean - gMean),
        Math.abs(gMean - bMean),
        Math.abs(rMean - bMean),
      )
      return maxDiff < 20
    } catch {
      return null
    }
  } catch {
    return null
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

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
  // scoped_passport_id: optional. If present and non-empty, the asset
  // is restricted to that passport (won't appear in pickers for other
  // passports). If absent or empty, the asset is library-wide. The
  // assets-page upload always omits this — uploads there are library
  // by definition; designer uploads default to scoped via this field.
  const scopedPassportIdRaw = formData.get('scoped_passport_id')
  const scopedPassportId = typeof scopedPassportIdRaw === 'string' && scopedPassportIdRaw.length > 0
    ? scopedPassportIdRaw
    : null

  // Account switcher: upload into the custodial library instead of the
  // caller's own. Allowed ONLY for platform admins — verified here via
  // the is_platform_admin RPC, never from the client-supplied flag alone.
  const asCustodial = formData.get('as_custodial') === 'true'
  let effectiveOwnerId = user.id
  let isBuiltIn = false
  if (asCustodial) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
    if (isAdmin !== true) {
      return NextResponse.json({ error: 'Not authorized to manage the okuji library' }, { status: 403 })
    }
    effectiveOwnerId = CUSTODIAL_ID
    isBuiltIn = true
  }

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
      { error: 'asset_type must be one of: background, stamp, cover, layout' },
      { status: 400 },
    )
  }

  // Validate scoped_passport_id (if provided) belongs to a passport the
  // user can read. RLS on passports already enforces ownership/access;
  // a successful SELECT is the authorization.
  if (scopedPassportId !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: passport, error: ppErr } = await (supabase as any)
      .from('passports')
      .select('id')
      .eq('id', scopedPassportId)
      .maybeSingle()
    if (ppErr || !passport) {
      return NextResponse.json(
        { error: 'scoped_passport_id does not reference a passport you can access' },
        { status: 400 },
      )
    }
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${effectiveOwnerId}/${assetType}/${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  let buffer = Buffer.from(bytes)

  // Run monochrome detection for stamp uploads
  let isMonochrome: boolean | null = null
  if (assetType === 'stamp') {
    isMonochrome = await detectMonochrome(buffer, file.type)
  }

  // Stamp + SVG → normalize the alpha-channel content bounds so the
  // stored file fills its container centered. Renders via sharp,
  // trims transparent edges, maps the resulting bbox back to SVG
  // coordinates, rewrites the root <svg>. Failure returns the
  // original buffer unchanged (upload is never blocked on this).
  if (assetType === 'stamp' && file.type === 'image/svg+xml') {
    const { normalizeStampSvgBuffer } = await import('@/lib/design/stamp-composer/normalize-svg-buffer')
    buffer = await normalizeStampSvgBuffer(buffer)
  }

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
      owner_id:           effectiveOwnerId,
      is_built_in:        isBuiltIn,
      name:               name ?? file.name,
      asset_type:         assetType,
      url:                publicUrl,
      storage_path:       storagePath,
      file_format:        file.type,
      // Migration 053: captured at upload time going forward. width_px /
      // height_px require sharp or a client-side measure step we don't
      // ship yet — left null; the drawer meta line degrades gracefully.
      bytes_size:         file.size,
      is_monochrome:      isMonochrome,
      scoped_passport_id: scopedPassportId,
    })
    .select('id, name, url, institution_id, is_monochrome, scoped_passport_id, bytes_size')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ...asset,
    monochrome_detected: isMonochrome !== null,
    is_monochrome: isMonochrome,
  })
}
