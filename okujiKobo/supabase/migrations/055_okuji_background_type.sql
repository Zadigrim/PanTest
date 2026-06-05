-- Migration 055: add 'okuji' to passport_pages background_type CHECK
-- constraint.
--
-- Promotes the built-in okuji preset grounds (public/presets/png/*)
-- to a first-class background type in the designer's left panel,
-- distinct from 'custom'. The DB representation is the same as
-- custom — background_image_url points at a /presets/png/... URL,
-- custom_background_opacity controls overlay opacity — so the
-- renderer in PageBackground.tsx treats 'okuji' identically to
-- 'custom' for image overlay rendering.
--
-- Why a separate type instead of leaving okuji selection inside
-- the 'custom' picker:
--   - Discovery: presets were buried behind "Custom image", which
--     made them feel like a secondary path.
--   - Cleanliness: the new 'okuji' option owns ONLY the static
--     presets (no upload + no library). 'custom' owns ONLY user
--     uploads + the design_assets library.
--
-- Rollback note: a DROP-then-ADD on the CHECK constraint, same
-- shape as migration 018. Pre-existing rows with the older types
-- continue to validate. No data migration of existing rows is
-- performed: anyone with type='custom' and a preset URL stays as
-- custom (renders identically); only NEW selections go under
-- 'okuji'.

ALTER TABLE public.passport_pages DROP CONSTRAINT IF EXISTS passport_pages_background_type_check;
ALTER TABLE public.passport_pages
  ADD CONSTRAINT passport_pages_background_type_check
  CHECK (background_type IN ('guilloche', 'landscape', 'none', 'custom', 'grid', 'okuji'));
