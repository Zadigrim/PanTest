-- Migration 069: passports credential_type + distribution_only (M2)
--
-- First half of the consumable-credential data model. Adds two
-- additive columns to passports + the leak-guard column the
-- application's listing queries gate on.
--
-- ADD ONLY — no behavioral change for existing rows. Defaults
-- carry every existing passport into the "persistent, listable"
-- bucket it was always in. Zero users / zero existing data, so
-- the defaults are also the truth for current rows.
--
-- credential_type:
--   'persistent' — today's model. One stamp per (user, stop)
--                  forever. Acquisitions preserved forever.
--                  The existing UNIQUE(user_id, stop_id) on
--                  stamps semantics (migration 014, mobile tree,
--                  enforces this via a partial index on
--                  card_instance_id IS NULL).
--   'consumable' — moichido punch-card. Per-instance stamping;
--                  cards consume and reissue. Code surface for
--                  this is M3 (issue + redeem functions) and M4
--                  (designer + terminal UI). M2 just permits
--                  the data shape.
--
-- distribution_only:
--   false — listable on Explore + marketplace (today's behavior).
--   true  — vendor-issued only; never listed publicly. Holders
--           who already have it (via M3 distribution) can still
--           view their copy and use it.
--
--   The application's listing surfaces (Explore browse + detail,
--   marketplace per-creator + per-passport, find_passports_nearby
--   RPC) gate on distribution_only=false. The marketplace passport
--   detail page additionally allows distribution_only=true reads
--   for holders — same pattern the existing unpublished-but-acquired
--   read uses (migration 062).
--
-- DEPLOY ORDER: this migration runs FIRST in the M2 set. The
-- mobile-tree migration 016 (find_passports_nearby RPC replacement)
-- references distribution_only and depends on this column existing.
--
-- ROLLBACK: ALTER TABLE … DROP COLUMN credential_type, DROP COLUMN
-- distribution_only. Safe because the application's listing
-- guards degrade to "no filter" — same as today.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS credential_type text NOT NULL DEFAULT 'persistent',
  ADD COLUMN IF NOT EXISTS distribution_only boolean NOT NULL DEFAULT false;

-- Re-declare the credential_type CHECK separately so a re-run
-- through a freshly-migrated DB doesn't double-add.
ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_credential_type_check;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_credential_type_check
  CHECK (credential_type IN ('persistent', 'consumable'));

-- Partial index — speeds the listing-surface query path that
-- now filters distribution_only=false. Most reads are public
-- (listable) passports, so the partial form keeps the index
-- size small.
CREATE INDEX IF NOT EXISTS passports_listable_idx
  ON public.passports (created_at DESC)
  WHERE is_published = true AND distribution_only = false;
