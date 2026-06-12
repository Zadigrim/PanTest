// Seed the built-in okuji table/grid layout presets into design_assets +
// the design-assets storage bucket, owned by the custodial account.
// Mirrors seed-okuji-presets.mjs (the page-background seeding). One-time
// (idempotent) ops action — run with the service-role key:
//
//   node --env-file=.env.local scripts/seed-okuji-layouts.mjs
//
// Run from the okujiKobo/ directory (it reads public/presets/layouts/).
// width_px / height_px are parsed from the SVG viewBox and stored so the
// designer's layout picker can aspect-snap the element box to the art's
// native ratio on selection.

import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CUSTODIAL_ID = '00000000-0000-0000-0000-000000000001'
const BUCKET = 'design-assets'

// The ticket layouts (label + file). Add entries here (and drop the SVG
// in public/presets/layouts/) to seed more.
const PRESETS = [
  { file: 'tickets-3-stops.svg', label: 'Tickets · 3 stops' },
  { file: 'tickets-4-stops.svg', label: 'Tickets · 4 stops' },
  { file: 'tickets-5-stops.svg', label: 'Tickets · 5 stops' },
  { file: 'tickets-6-stops.svg', label: 'Tickets · 6 stops' },
]

function die(m) { console.error(`\n✖ ${m}`); process.exit(1) }
if (!SUPABASE_URL) die('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL')
if (!SERVICE_ROLE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY')

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function parseViewBox(svgText) {
  const m = svgText.match(/viewBox="([\d.\s-]+)"/)
  if (!m) return { width: null, height: null }
  const parts = m[1].trim().split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return { width: null, height: null }
  return { width: Math.round(parts[2]), height: Math.round(parts[3]) }
}

async function main() {
  // Custodial profile must exist (migration 049 seeds it).
  const { data: prof } = await db.from('profiles').select('id').eq('id', CUSTODIAL_ID).maybeSingle()
  if (!prof) die('Custodial profile not found — apply migration 049 first.')

  for (const p of PRESETS) {
    const localPath = path.join(process.cwd(), 'public', 'presets', 'layouts', p.file)
    let bytes
    try { bytes = await fs.readFile(localPath) }
    catch { console.warn(`· skip ${p.file} (not found at ${localPath})`); continue }

    const { width, height } = parseViewBox(bytes.toString('utf8'))
    const storagePath = `${CUSTODIAL_ID}/layout/${p.file}`

    // Upload (idempotent via upsert).
    const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: 'image/svg+xml', upsert: true,
    })
    if (upErr) die(`upload ${p.file}: ${upErr.message}`)

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    // Insert the design_assets row if one isn't already there for this path.
    const { data: existing } = await db
      .from('design_assets')
      .select('id, url')
      .eq('storage_path', storagePath)
      .maybeSingle()

    if (existing) {
      // Keep url + metadata fresh (e.g. re-seeding after editing the art).
      await db.from('design_assets')
        .update({ url: publicUrl, name: p.label, width_px: width, height_px: height, bytes_size: bytes.length })
        .eq('id', existing.id)
      console.log(`✓ updated row for ${p.file}`)
    } else {
      const { error: insErr } = await db.from('design_assets').insert({
        owner_id: CUSTODIAL_ID,
        asset_type: 'layout',
        is_built_in: true,
        name: p.label,
        url: publicUrl,
        storage_path: storagePath,
        file_format: 'image/svg+xml',
        bytes_size: bytes.length,
        width_px: width,
        height_px: height,
        is_monochrome: false,
        scoped_passport_id: null,
      })
      if (insErr) die(`insert ${p.file}: ${insErr.message}`)
      console.log(`✓ seeded ${p.file} (${width}×${height})`)
    }
  }
  console.log('\nDone.')
}

main()
