-- Migration 082: add 'layout' to design_assets.asset_type
--
-- Table/grid layout elements — thin-lined, alpha-channel SVG art a
-- designer places on a page to organize stamps and structure content
-- (v1: pre-made assets placed and sized; parametric tables are future
-- work). They get their own asset category (a "Layouts" tab in the
-- Assets section) rather than riding under 'image' because the print
-- renderer treats them differently: layout art keeps its alpha and is
-- rasterized at high density so thin lines stay crisp, while ordinary
-- page images are flattened onto the page paper color (the existing
-- behavior, deliberately unchanged for already-published passports).
--
-- Mirrors migration 043 (which added 'image' the same way). Everything
-- else — scoping (scoped_passport_id), in-use detection
-- (list_asset_references scans elements jsonb by URL), delete
-- protection, the custodial built-in library — already works for any
-- asset_type and needs no change.
--
-- ROLLBACK: re-add the CHECK without 'layout' (after deleting any
-- layout rows).

ALTER TABLE public.design_assets
  DROP CONSTRAINT IF EXISTS design_assets_asset_type_check;

ALTER TABLE public.design_assets
  ADD CONSTRAINT design_assets_asset_type_check
  CHECK (asset_type IN ('background', 'stamp', 'cover', 'image', 'layout'));
