-- Allow 'image' as a design_assets type. Previously the CHECK constraint
-- only permitted 'background', 'stamp', and 'cover' — so the page-element
-- image upload path (the per-page image element) had nowhere to store an
-- asset record, forcing users to re-upload the same image file on every
-- page even though the file already lived in storage. The new tag lets
-- the designer's image-element picker list previously-uploaded images
-- for reselection.

ALTER TABLE public.design_assets
  DROP CONSTRAINT IF EXISTS design_assets_asset_type_check;

ALTER TABLE public.design_assets
  ADD CONSTRAINT design_assets_asset_type_check
  CHECK (asset_type IN ('background', 'stamp', 'cover', 'image'));
