'use client'

import { createClient } from '@/lib/supabase/client'
import type { ComposerMetadata } from '@/lib/design/stamp-composer/types'

/**
 * Persist a composed stamp.
 *
 * Pipeline:
 *   1. Build an SVG Blob from the serialized string.
 *   2. Upload to the `design-assets` Storage bucket under
 *      `{owner_id}/stamp-{timestamp}.svg`.
 *   3. Insert a fresh design_assets row (asset_type='stamp',
 *      file_format='image/svg+xml', is_monochrome=true since
 *      the composer enforces a single ink) with metadata +
 *      parent_asset_id from migration 056. Scoping mirrors the
 *      existing CustomBgPicker pattern.
 *
 * SAVE-AS-NEW-VERSION (vs overwrite) is the chosen policy
 * (Phase 0 question). Each call inserts a new row and threads
 * the prior id via parent_asset_id.
 *
 * Returns the new asset row's { id, url } so the launcher can
 * select it in the picker.
 */
export async function saveComposedStamp({
  svg,
  metadata,
  name,
  parentAssetId,
  scopedPassportId,
}: {
  svg: string
  metadata: ComposerMetadata
  name: string
  parentAssetId: string | null
  scopedPassportId: string | null
}): Promise<{ id: string; url: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // ── 1. Upload SVG file to storage ──
  const path = `${user.id}/stamp-${Date.now()}.svg`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const { error: upErr } = await supabase.storage
    .from('design-assets')
    .upload(path, blob, { contentType: 'image/svg+xml' })
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

  const { data: { publicUrl } } = supabase.storage.from('design-assets').getPublicUrl(path)

  // ── 2. Insert design_assets row ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insErr } = await (supabase as any)
    .from('design_assets')
    .insert({
      owner_id:           user.id,
      asset_type:         'stamp',
      name,
      url:                publicUrl,
      storage_path:       path,
      file_format:        'image/svg+xml',
      bytes_size:         blob.size,
      is_monochrome:      true,
      scoped_passport_id: scopedPassportId,
      metadata,            // migration 056 — composer source of truth
      parent_asset_id:    parentAssetId,
    })
    .select('id, url')
    .single()

  if (insErr || !data) throw new Error(`Insert failed: ${insErr?.message ?? 'no row'}`)
  return data as { id: string; url: string }
}
