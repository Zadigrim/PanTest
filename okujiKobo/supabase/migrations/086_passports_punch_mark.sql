-- 086_passports_punch_mark.sql
-- Card-level punch mark for moichido (consumable) cards.
--
-- A moichido card has ONE punch mark across all its punch slots (mirrors the
-- CardPunchShape "one shape per card" model). These columns are the card-level
-- analogue of stops.stamp_type / stamp_icon / stamp_asset_id, but live on the
-- passport because punch_slots (mobile migration 028) are intentionally
-- position-only — the mark is not per-slot.
--
--   punch_type     'emoji' (default) renders punch_icon; 'custom_asset' renders
--                  punch_asset_id (a composed SVG designed in the reused
--                  StampComposer and stored in design_assets as asset_type
--                  'stamp' — no new asset type needed).
--   punch_icon     glyph for the emoji path (default heavy-circle ring).
--   punch_asset_id design_assets FK; ON DELETE SET NULL so a deleted asset
--                  degrades gracefully (the renderer falls back to punch_icon).
--
-- ADD ONLY — defaults carry every existing passport into the emoji/ring state
-- it already had. Persistent (okuji) passports simply never use these. Web
-- tree (alongside the other consumable columns, 069/071); zero users.
--
-- ROLLBACK: DROP the three columns + the check constraint.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS punch_type     text NOT NULL DEFAULT 'emoji',
  ADD COLUMN IF NOT EXISTS punch_icon     text NOT NULL DEFAULT '⭕',
  ADD COLUMN IF NOT EXISTS punch_asset_id uuid NULL REFERENCES public.design_assets(id) ON DELETE SET NULL;

ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_punch_type_check;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_punch_type_check
  CHECK (punch_type IN ('emoji', 'custom_asset'));
