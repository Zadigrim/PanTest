-- Ensure PostGIS types resolve when the legacy
-- sync_stop_target_location trigger (migration 008) fires during the
-- backfill UPDATE below. Supabase moved the postgis extension out of
-- `public` into `extensions`, so an unqualified `geography` reference
-- inside that trigger fails without `extensions` on the search_path.
SET search_path = public, extensions, pg_catalog;

-- Also harden the legacy trigger function so this can't bite again in
-- future migrations: pin its own search_path. Idempotent — pure ALTER.
ALTER FUNCTION public.sync_stop_target_location() SET search_path = public, extensions, pg_catalog;

-- Reconcile three overlapping "how is this stop verified?" fields on
-- public.stops into ONE canonical two-level model. Until now the
-- designer could set:
--
--   • experience_type ('location' | 'experience')
--   • experience_verification_method ('witnessed' | 'documented'
--                                    | 'presence' | 'honor')
--   • verification_tier  (integer 1-5)
--   • location_type      (migration 042: 'address' | 'coordinates'
--                                       | 'honor')
--
-- …and the UI labelled the tier with values that did NOT match what
-- verify-stamp actually does. This migration picks ONE source of truth
-- and derives the rest from it.
--
-- CANONICAL (designer + storage):
--   experience_type                       — Level 1 (Location | Event)
--   experience_verification_method        — Level 2 (only when
--                                           experience_type='location';
--                                           forced to 'honor' when
--                                           experience_type='experience')
--
-- DERIVED (set by trigger before INSERT/UPDATE):
--   verification_tier  — drives verify-stamp behaviour. The mapping
--                        below is chosen so verify-stamp's existing
--                        branch decisions (T1/T2 = QR+GPS, T3 = GPS,
--                        T4 = employee, T5 = honor bypass) keep working
--                        for the new method values without ANY code
--                        change in supabase/functions/verify-stamp.
--
-- RETIRED (column stays for backward compat; new code does not read
-- or write it):
--   location_type      — superseded by experience_type +
--                        experience_verification_method. Existing rows
--                        keep their value; the column will be dropped
--                        in a later cleanup once nothing reads it.

-- ─── 1. Widen experience_verification_method to allow gps + qr ───────────────
ALTER TABLE public.stops
  DROP CONSTRAINT IF EXISTS stops_experience_verification_method_check;
ALTER TABLE public.stops
  DROP CONSTRAINT IF EXISTS stops_experience_verification_check;
ALTER TABLE public.stops
  ADD CONSTRAINT stops_experience_verification_method_check
  CHECK (
    experience_verification_method IS NULL
    OR experience_verification_method IN (
         'gps', 'qr', 'witnessed', 'documented',
         -- 'presence' kept for backward compat with rows written before
         -- this migration; new code uses 'gps' or 'qr' explicitly.
         'presence',
         'honor'
       )
  );

-- ─── 2. Backfill existing rows ────────────────────────────────────────────────
-- For every stop whose canonical pair is currently NULL, derive it from
-- the legacy verification_tier so the designer can hydrate cleanly:
--
--   T1, T2  → location + 'qr'        (T1/T2 both = QR+GPS in verify-stamp;
--                                     collapse into a single 'qr' method)
--   T3      → location + 'gps'
--   T4      → location + 'witnessed'
--   T5      → experience + 'honor'   (T5 is the verify-stamp self-reported
--                                     bypass, matching the new "Event/
--                                     Activity = honor system" model)
--
-- Rows with experience_type already populated to 'experience' but a
-- non-honor method (e.g. an older workshop tagged as experience +
-- witnessed) keep their existing method — the institutional terminal
-- flow still reads those.

UPDATE public.stops
   SET experience_type = COALESCE(experience_type, CASE
         WHEN verification_tier = 5 THEN 'experience'
         ELSE 'location'
       END),
       experience_verification_method = COALESCE(experience_verification_method, CASE
         WHEN verification_tier = 1 THEN 'qr'
         WHEN verification_tier = 2 THEN 'qr'
         WHEN verification_tier = 3 THEN 'gps'
         WHEN verification_tier = 4 THEN 'witnessed'
         WHEN verification_tier = 5 THEN 'honor'
         ELSE 'gps'
       END)
 WHERE experience_type IS NULL OR experience_verification_method IS NULL;

-- ─── 3. Trigger: derive verification_tier from the canonical pair ────────────
-- Runs BEFORE INSERT OR UPDATE so the verification_tier the verify-stamp
-- function reads is always in sync with the designer's choice. The
-- designer code itself does NOT need to write verification_tier any more.
--
-- 'presence' is the only legacy method that doesn't get re-derived
-- (rows written with 'presence' keep whatever tier was set explicitly);
-- this matches the existing behaviour for those rows and avoids
-- silently mutating them.

CREATE OR REPLACE FUNCTION public.sync_verification_tier_from_method()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Level 1 = Event/Activity → always honor → T5 (verify-stamp bypass).
  -- The method is forced to 'honor' so the canonical pair stays consistent.
  IF NEW.experience_type = 'experience' THEN
    NEW.experience_verification_method := 'honor';
    NEW.verification_tier := 5;
    RETURN NEW;
  END IF;

  -- Level 1 = Location → Level 2 drives the tier.
  CASE NEW.experience_verification_method
    WHEN 'gps'        THEN NEW.verification_tier := 3;
    WHEN 'qr'         THEN NEW.verification_tier := 2;
    WHEN 'witnessed'  THEN NEW.verification_tier := 4;
    WHEN 'documented' THEN NEW.verification_tier := 5;
    WHEN 'honor'      THEN NEW.verification_tier := 5;
    ELSE
      -- 'presence' or NULL: leave verification_tier alone (legacy
      -- callers may have set it explicitly).
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stops_sync_verification_tier ON public.stops;
CREATE TRIGGER stops_sync_verification_tier
  BEFORE INSERT OR UPDATE ON public.stops
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_verification_tier_from_method();

-- ─── 4. Mark location_type as retired ────────────────────────────────────────
COMMENT ON COLUMN public.stops.location_type IS
  'Retired by migration 046 in favour of (experience_type, experience_verification_method). Existing rows keep their value for read-only backward compat; new code MUST NOT read or write this column. Plan to drop in a later cleanup migration once no surface reads it.';
