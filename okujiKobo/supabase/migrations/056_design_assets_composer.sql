-- Migration 056: stamp composer foundation
--
-- Adds two columns to design_assets so the new in-app stamp
-- COMPOSER (modal in the designer + Assets surface) can:
--   1. persist the editable element list it built the SVG from,
--      so reopening the composer reconstructs the live editing
--      state (curved text, ellipses, rotations, …) instead of
--      flattened paths;
--   2. thread version history without overwriting placed assets.
--      Each save inserts a NEW design_assets row; existing
--      placements keep their stable URL. parent_asset_id links
--      the chain so the picker can collapse versions later.
--
-- Both columns are nullable + optional:
--   - Uploaded stamps (no composer trip) have metadata=NULL and
--     parent_asset_id=NULL — the "Edit in composer" affordance
--     keys off metadata IS NOT NULL.
--   - The first composer save of a new design has metadata SET
--     and parent_asset_id=NULL (it's the root version).
--
-- metadata schema (TypeScript source of truth in
-- lib/design/stamp-composer/types.ts → ComposerMetadata):
--   {
--     version:   1,
--     surface:   { w: number; h: number },  // viewBox dimensions
--     elements:  ComposerElement[],
--   }
--
-- The shape evolves; `version` is the migration handle so older
-- saves can be upgraded by the parser.
--
-- ROLLBACK: DROP COLUMN metadata, parent_asset_id. Nothing
-- references either yet outside the composer; existing
-- placements survive (URL is unchanged).

ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS metadata        jsonb,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS design_assets_parent_idx
  ON public.design_assets (parent_asset_id)
  WHERE parent_asset_id IS NOT NULL;
