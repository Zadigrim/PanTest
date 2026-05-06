import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ASSET_TYPES = ['background', 'stamp', 'cover'] as const
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
      // Dynamic import so the build doesn't fail if Jimp is absent
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Jimp = (await import('jimp').catch(() => null))
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

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${user.id}/${assetType}/${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Run monochrome detection for stamp uploads
  let isMonochrome: boolean | null = null
  if (assetType === 'stamp') {
    isMonochrome = await detectMonochrome(buffer, file.type)
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
      owner_id:      user.id,
      name:          name ?? file.name,
      asset_type:    assetType,
      url:           publicUrl,
      storage_path:  storagePath,
      file_format:   file.type,
      is_monochrome: isMonochrome,
    })
    .select('id, name, url, institution_id, is_monochrome')
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
