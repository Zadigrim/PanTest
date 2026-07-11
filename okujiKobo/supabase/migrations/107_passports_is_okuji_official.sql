-- 107: mark okuji-made passports so the print pipeline can brand them.
--
-- PROVENANCE. Nothing in the schema previously distinguished an okuji-made
-- passport from a third-party creator's. creator_id points at a real personal
-- account (the seeder's SEED_CREATOR_ID), proprietor_id is null for okuji
-- (no institution), and is_demo is a different axis (admin viewing bypass /
-- any-holder stamp — migrations 039 + 105). So we add a dedicated boolean.
--
-- CONSUMER. The home-printer booklet PDF (app/api/passports/[id]/print-pdf)
-- stamps a QR code (-> https://okuji.app) dead-center on the back cover of
-- every okuji-official passport, REGARDLESS of price. This is separate from
-- the free-passport marketing strip, which keeps its own price_cents = 0 gate.
--
-- WRITE GUARD. Same shape as guard_passports_is_demo (migration 105): a
-- BEFORE INSERT OR UPDATE trigger rejects any non-admin change to
-- is_okuji_official. Without it, any third-party creator could self-set the
-- flag and mint the okuji QR onto their own back cover. Trusted paths are
-- preserved — the service role / direct SQL (auth.uid() IS NULL, the seeder
-- path) and platform admins are unrestricted. Normal create/publish never
-- sets it (default false), so they are unaffected.
--
-- ROLLBACK: drop the trigger + function, then the column.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS is_okuji_official boolean NOT NULL DEFAULT false;

-- ── Write guard ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_passports_is_okuji_official()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_okuji_official, false) = true
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passports.is_okuji_official may only be set by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_okuji_official IS DISTINCT FROM OLD.is_okuji_official
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passports.is_okuji_official may only be changed by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_passports_is_okuji_official ON public.passports;
CREATE TRIGGER trg_guard_passports_is_okuji_official
  BEFORE INSERT OR UPDATE ON public.passports
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_passports_is_okuji_official();

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- "Made by me = made by okuji": every passport on the owner account is official.
--
-- NOTE: this migration was authored in an ephemeral clone with no .env.local
-- present, so the real SEED_CREATOR_ID (your profiles.id UUID) could NOT be
-- inlined automatically. Replace the placeholder below with that UUID before
-- running this migration. The DO block fails loudly if the placeholder is left
-- in place, so the backfill can never run against a bogus id.
--
-- Runs in migration context (auth.uid() IS NULL), which the write guard above
-- permits, so the UPDATE is not blocked.
DO $$
DECLARE
  seed_creator_id constant text := '__SEED_CREATOR_ID__';
BEGIN
  IF seed_creator_id = '__SEED_CREATOR_ID__' THEN
    RAISE EXCEPTION
      'migration 107 backfill: replace __SEED_CREATOR_ID__ with your SEED_CREATOR_ID (profiles.id UUID) before running';
  END IF;

  UPDATE public.passports
    SET is_okuji_official = true
    WHERE creator_id = seed_creator_id::uuid
      AND is_okuji_official = false;
END $$;
