-- Migration 008: Create Supabase Storage buckets
-- Idempotent — ON CONFLICT DO NOTHING.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('design-assets', 'design-assets', true),
  ('avatars',       'avatars',       true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to design-assets
CREATE POLICY IF NOT EXISTS "design_assets_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-assets');

CREATE POLICY IF NOT EXISTS "design_assets_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'design-assets');

CREATE POLICY IF NOT EXISTS "design_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'design-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to upload their own avatar
CREATE POLICY IF NOT EXISTS "avatars_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "avatars_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "avatars_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'avatars');
