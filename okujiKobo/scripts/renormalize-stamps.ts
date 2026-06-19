// One-time: re-normalize stored SVG stamp assets IN PLACE.
//
// Fixes stamps uploaded before the trim-offset sign fix (the troll batch and
// any other raw uploads) whose stored viewBox doesn't tightly bound the
// content, so they render offset/clipped in a LocationBox. Re-uploads to the
// SAME storage_path (upsert) — the public URL, asset id, and every stop that
// references the stamp stay intact. Idempotent: re-normalizing an
// already-tight SVG yields the same frame.
//
// Usage (from okujiKobo/, where storage + sharp are reachable):
//   npx tsx --env-file=.env.local scripts/renormalize-stamps.ts
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// A stamp that can't be normalized (genuine render failure) is LEFT untouched
// and flagged — re-export it as a clean SVG and re-upload through the designer.

import { createClient } from '@supabase/supabase-js'
import { normalizeStampSvgBuffer } from '@/lib/design/stamp-composer/normalize-svg-buffer'

function rootViewBox(svg: string): string {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  return root.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1] ?? '(none)'
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: assets, error } = await sb
    .from('design_assets')
    .select('id, name, storage_path, file_format, url')
    .eq('asset_type', 'stamp')
  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svgs = ((assets ?? []) as any[]).filter(
    (a) => a.file_format === 'image/svg+xml' || String(a.url ?? '').toLowerCase().endsWith('.svg'),
  )
  console.log(`Found ${svgs.length} SVG stamp assets.\n`)

  let fixed = 0
  let unchanged = 0
  let failed = 0
  for (const a of svgs) {
    if (!a.storage_path) {
      console.log(`- ${a.name}: no storage_path — skipped`)
      failed++
      continue
    }
    const { data: blob, error: dlErr } = await sb.storage.from('design-assets').download(a.storage_path)
    if (dlErr || !blob) {
      console.log(`! ${a.name}: download failed (${dlErr?.message ?? 'no data'}) — skipped`)
      failed++
      continue
    }
    const before = Buffer.from(await blob.arrayBuffer())
    const beforeVb = rootViewBox(before.toString('utf-8'))

    let after: Buffer
    try {
      after = await normalizeStampSvgBuffer(before)
    } catch (e) {
      console.log(`! ${a.name}: UN-NORMALIZABLE (${(e as Error).message}) — left as-is; re-export a clean SVG`)
      failed++
      continue
    }
    const afterVb = rootViewBox(after.toString('utf-8'))

    const { error: upErr } = await sb.storage
      .from('design-assets')
      .upload(a.storage_path, after, { contentType: 'image/svg+xml', upsert: true })
    if (upErr) {
      console.log(`! ${a.name}: re-upload failed (${upErr.message})`)
      failed++
      continue
    }

    if (beforeVb === afterVb) {
      console.log(`= ${a.name}: already tight (viewBox ${afterVb})`)
      unchanged++
    } else {
      console.log(`✓ ${a.name}: viewBox ${beforeVb}  ->  ${afterVb}`)
      fixed++
    }
  }

  console.log(`\nDone. reframed=${fixed} already-tight=${unchanged} failed=${failed}`)
  console.log('Note: Supabase storage may serve the old bytes from CDN cache briefly; a hard refresh shows the new frame.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
