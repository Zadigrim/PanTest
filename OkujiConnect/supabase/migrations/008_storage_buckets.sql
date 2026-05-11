-- Migration 008: Create Supabase Storage buckets
-- Idempotent — ON CONFLICT DO NOTHING for buckets, DROP IF EXISTS for policies.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('design-assets', 'design-assets', true),
  ('avatars',       'avatars',       true)
ON CONFLICT (id) DO NOTHING;

-- ── design-assets policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "design_assets_upload" ON storage.objects;
CREATE POLICY "design_assets_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-assets');

DROP POLICY IF EXISTS "design_assets_read" ON storage.objects;
CREATE POLICY "design_assets_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'design-assets');

DROP POLICY IF EXISTS "design_assets_delete" ON storage.objects;
CREATE POLICY "design_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'design-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── avatars policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
CREATE POLICY "avatars_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');
