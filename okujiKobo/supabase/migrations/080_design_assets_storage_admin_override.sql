-- Migration 080: let platform admins manage design-assets storage in any
-- folder (enables the asset-library account switcher to upload/delete as
-- the okuji custodial account).
--
-- The design-assets bucket policies (008 / 031) scope writes to the
-- caller's own uid folder: (storage.foldername(name))[1] = auth.uid().
-- That blocks a platform admin from uploading a built-in preset into the
-- custodial folder ({custodial_id}/...). The design_assets TABLE write
-- policy already has an is_admin() override; this mirrors it on storage
-- so the two surfaces agree. Non-admins are unaffected (the original
-- uid-folder clause still applies to them).
--
-- Additive; recreates the two policies with an added admin branch.
-- ROLLBACK: recreate without the "OR is_platform_admin()" clause.

DROP POLICY IF EXISTS "design_assets_upload" ON storage.objects;
CREATE POLICY "design_assets_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-assets'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (select public.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS "design_assets_delete" ON storage.objects;
CREATE POLICY "design_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'design-assets'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (select public.is_platform_admin())
    )
  );
