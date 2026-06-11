// Seed the built-in okuji page-background presets into design_assets +
// the design-assets storage bucket, owned by the custodial account, and
// backfill existing pages that referenced the old /presets/... paths.
// One-time (idempotent) ops action — run with the service-role key:
//
//   node --env-file=.env.local scripts/seed-okuji-presets.mjs
//
// Run from the okujiKobo/ directory (it reads public/presets/png/).
// Service-role bypasses storage + table RLS, so this works regardless of
// the migration-080 admin-override (that override is for the in-app
// account switcher, not this seed).

import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CUSTODIAL_ID = '00000000-0000-0000-0000-000000000001'
const BUCKET = 'design-assets'

// The canonical six grounds (label + file), matching the previous
// hardcoded OKUJI_PAGE_BACKGROUNDS list. Add entries here (and drop the
// PNG in public/presets/png/) to seed more.
const PRESETS = [
  { file: 'okuji-ground-01-guilloche-medallion.png',  label: 'Guilloche medallion' },
  { file: 'okuji-ground-02-topographic-contours.png', label: 'Topographic contours' },
  { file: 'okuji-ground-03-woven-waves.png',          label: 'Woven waves' },
  { file: 'okuji-ground-04-trail-waypoints.png',      label: 'Trail waypoints' },
  { file: 'okuji-ground-05-rosette-tiling.png',       label: 'Rosette tiling' },
  { file: 'okuji-ground-06-field-rule.png',           label: 'Field rule' },
]

function die(m) { console.error(`\n✖ ${m}`); process.exit(1) }
if (!SUPABASE_URL) die('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL')
if (!SERVICE_ROLE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY')

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Custodial profile must exist (migration 049 seeds it).
  const { data: prof } = await db.from('profiles').select('id').eq('id', CUSTODIAL_ID).maybeSingle()
  if (!prof) die('Custodial profile not found — apply migration 049 first.')

  for (const p of PRESETS) {
    const localPath = path.join(process.cwd(), 'public', 'presets', 'png', p.file)
    let bytes
    try { bytes = await fs.readFile(localPath) }
    catch { console.warn(`· skip ${p.file} (not found at ${localPath})`); continue }

    const storagePath = `${CUSTODIAL_ID}/background/${p.file}`

    // Upload (idempotent via upsert).
    const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: 'image/png', upsert: true,
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
      // Keep url fresh in case the project ref changed.
      await db.from('design_assets').update({ url: publicUrl, name: p.label }).eq('id', existing.id)
      console.log(`✓ updated row for ${p.file}`)
    } else {
      const { error: insErr } = await db.from('design_assets').insert({
        owner_id: CUSTODIAL_ID,
        asset_type: 'background',
        is_built_in: true,
        name: p.label,
        url: publicUrl,
        storage_path: storagePath,
        file_format: 'image/png',
      })
      if (insErr) die(`insert ${p.file}: ${insErr.message}`)
      console.log(`✓ seeded ${p.file} -> ${publicUrl}`)
    }

    // Backfill pages still pointing at the old relative preset path.
    const oldUrl = `/presets/png/${p.file}`
    const { data: bf, error: bfErr } = await db
      .from('passport_pages')
      .update({ background_image_url: publicUrl })
      .eq('background_image_url', oldUrl)
      .select('id')
    if (bfErr) console.warn(`· backfill ${p.file}: ${bfErr.message}`)
    else if (bf?.length) console.log(`  ↳ backfilled ${bf.length} page(s) from ${oldUrl}`)
  }

  console.log('\n✓ DONE — okuji preset backgrounds seeded into the asset library.')
}

main().catch((e) => die(e?.message ?? String(e)))
