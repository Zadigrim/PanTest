-- 053_design_assets_display_name.sql
--
-- Assets-section redesign companion:
--
-- (1) `display_name` — friendly title a user picks via Rename in the
--     asset drawer. `name` continues to hold the original filename so
--     the asset card can show "{display_name}" over "{name}" (raw
--     filename as secondary mono line). When display_name is null
--     the UI falls back to a prettified version of `name`.
--
-- (2) `bytes_size` — captured at upload time going forward (the
--     upload route reads file.size). Powers the drawer's meta line
--     ("FORMAT · SIZE"). Nullable so legacy rows degrade gracefully.
--
-- (3) `width_px` / `height_px` — reserved for the eventual
--     dimension capture path (would need sharp at upload or a
--     client-side measurement step). Nullable, never populated by
--     this migration; meta line omits the WxH bit when null.
--
-- NO BACKFILL. Touching N years of historical rows for bytes/dim
-- isn't worth a heavy migration; the UI is designed to degrade.

ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bytes_size   bigint,
  ADD COLUMN IF NOT EXISTS width_px     integer,
  ADD COLUMN IF NOT EXISTS height_px    integer;

COMMENT ON COLUMN public.design_assets.display_name IS
  'User-chosen friendly title via the asset drawer Rename action; null = derive from name.';
COMMENT ON COLUMN public.design_assets.bytes_size IS
  'File size in bytes; captured at upload from file.size. Nullable on legacy rows.';
COMMENT ON COLUMN public.design_assets.width_px IS
  'Image pixel width; null on legacy rows and on uploads without sharp/client measurement.';
COMMENT ON COLUMN public.design_assets.height_px IS
  'Image pixel height; see width_px.';
