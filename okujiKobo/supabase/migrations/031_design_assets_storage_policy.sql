-- Tighten the design-assets storage bucket INSERT policy so that the
-- first path segment of the uploaded object must equal the caller's
-- auth.uid(). The DELETE policy already enforces this; the INSERT policy
-- only checked bucket_id, so a hand-crafted upload could write into
-- another user's folder. Application code already constructs paths under
-- {user.id}/..., so this brings the policy in line with the existing
-- behavior and closes the gap.
--
-- Companion: matches the pattern in okuji-db/.../000_baseline.sql:778-781
-- (design_assets_delete) and 002_connect_schema.sql avatar policies.

DROP POLICY IF EXISTS "design_assets_upload" ON storage.objects;
CREATE POLICY "design_assets_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
