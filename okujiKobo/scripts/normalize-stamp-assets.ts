// Re-serialize every stamp design_asset's stored SVG using the
// current composer serializer. Cleans up two artifacts of the
// pre-bbox-fix save path:
//
//   1. viewBox="0 0 256 256" (full surface) instead of tight to
//      content. With the wide viewBox, content drawn anywhere
//      inside the canvas rendered scaled-down + corner-anchored
//      in every consumer.
//   2. Missing width="100%" height="100%" attributes on the SVG
//      root. The kobo StampPreview inlines the SVG via
//      dangerouslySetInnerHTML; without explicit dimensions, the
//      SVG falls back to its viewBox's intrinsic size and may not
//      fill its container.
//
// This script reads design_assets.metadata (jsonb, ComposerMetadata
// from migration 056) and re-runs the canonical serializer against
// the SAME element graph, then re-uploads. Stamps whose metadata
// is missing (uploaded outside the composer, e.g. raw SVG upload
// pre-056) are skipped — we don't have the element source for them.
//
// Usage (from okujiKobo/):
//   npm run normalize:stamps
//
// Env vars required (in .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     — service role bypasses RLS
//
// Idempotent: re-running re-serializes; the output is stable for a
// given metadata. Safe.

import { createClient } from '@supabase/supabase-js'
import { serializeStampSvg } from '@/lib/design/stamp-composer/svg'
import type { ComposerMetadata } from '@/lib/design/stamp-composer/types'

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

interface StampAssetRow {
  id: string
  name: string | null
  storage_path: string | null
  metadata: ComposerMetadata | null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) fail('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  if (!key) fail('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient(url!, key!, { auth: { persistSession: false } }) as any

  console.log('\nNormalizing stamp design_assets…\n')

  const { data: rows, error } = await sb
    .from('design_assets')
    .select('id, name, storage_path, metadata')
    .eq('asset_type', 'stamp')
    .eq('file_format', 'image/svg+xml')
  if (error) fail(`Lookup failed: ${error.message}`)

  const stamps = (rows ?? []) as StampAssetRow[]
  console.log(`Found ${stamps.length} stamp asset(s).\n`)

  let normalized = 0
  let skipped = 0
  let failed = 0

  for (const row of stamps) {
    if (!row.metadata || !Array.isArray(row.metadata.elements)) {
      console.log(`  · skip ${row.id} (${row.name ?? 'unnamed'}) — no composer metadata`)
      skipped++
      continue
    }
    if (!row.storage_path) {
      console.log(`  · skip ${row.id} (${row.name ?? 'unnamed'}) — no storage_path`)
      skipped++
      continue
    }

    const svg = serializeStampSvg(row.metadata)
    const blob = new Blob([svg], { type: 'image/svg+xml' })

    const { error: upErr } = await sb.storage
      .from('design-assets')
      .upload(row.storage_path, blob, {
        contentType: 'image/svg+xml',
        upsert: true,
      })
    if (upErr) {
      console.log(`  ✗ ${row.id} (${row.name ?? 'unnamed'}) — upload failed: ${upErr.message}`)
      failed++
      continue
    }
    // Update bytes_size to match the new file. Other columns are
    // unchanged (the canonical url + storage_path are stable).
    await sb
      .from('design_assets')
      .update({ bytes_size: blob.size })
      .eq('id', row.id)
    console.log(`  ✓ ${row.id} (${row.name ?? 'unnamed'})`)
    normalized++
  }

  console.log(
    `\nDone. normalized=${normalized} skipped=${skipped} failed=${failed}\n`,
  )
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e))
})
