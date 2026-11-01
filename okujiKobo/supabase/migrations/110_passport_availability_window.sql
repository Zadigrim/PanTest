-- 110_passport_availability_window.sql
--
-- Passport availability window (effective / expire). Lets a creator set an
-- optional start and end instant on a passport; collectors can only stamp it
-- inside that window. Use cases: a food-cart passport that runs Jan 1–Dec 31,
-- an event passport (expo) live only between opening and closing day.
--
-- DESIGN:
--   * passports.effective_at / expires_at are UTC instants; NULL = no bound on
--     that side. availability_timezone is the IANA zone used ONLY for display /
--     for turning "Dec 31" into end-of-day local (the designer converts; the DB
--     stores the resulting UTC instant). No new status — "not yet open" and
--     "ended" are DERIVED from the dates, never stored.
--   * ONE rule lives in public.passport_is_stampable(passport_id, at). Three
--     BEFORE INSERT triggers call it so every stamp / punch / acquire path is
--     gated at the DB and cannot be bypassed by a client — stamps and punches
--     are already service-role / SECURITY-DEFINER-only writes, and this closes
--     the window rule over them in one place.
--   * ADDITIVE + NON-RETROACTIVE: every existing passport gets NULLs, so the
--     helper returns true and all three triggers are no-ops — behaviour is
--     byte-identical to today. No backfill.
--   * These columns are creator-editable under the existing passports
--     creator-owns RLS (078); they are ordinary nullable columns and need NO
--     admin-write guard (unlike is_demo/is_okuji_official, which were carved
--     OUT of that permissive surface by 105/107).
--
-- Judgment calls (approved): acquiring is allowed BEFORE effective_at but
-- blocked AFTER expires_at; already-earned stamps are never removed/hidden; a
-- collector copy's expires_at = LEAST(acquired_at + expiry_duration_days,
-- passport.expires_at); stamping uses server now() only; the window is
-- whole-passport (stops.effective_at/expires_at could be added later the same
-- way). Start inclusive (now() >= effective_at), end exclusive (now() < expires_at).
--
-- ROLLBACK: drop the three triggers + their functions + passport_is_stampable +
-- assert_passport_stampable, then ALTER TABLE public.passports DROP COLUMN
-- effective_at, expires_at, availability_timezone.

-- 1. Columns ----------------------------------------------------------------
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS effective_at          timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at            timestamptz,
  ADD COLUMN IF NOT EXISTS availability_timezone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'passports_availability_window_order'
  ) THEN
    ALTER TABLE public.passports
      ADD CONSTRAINT passports_availability_window_order
      CHECK (effective_at IS NULL OR expires_at IS NULL OR expires_at > effective_at);
  END IF;
END $$;

COMMENT ON COLUMN public.passports.effective_at IS 'Availability window start (UTC instant). NULL = no start bound. Stamping allowed when now() >= effective_at (migration 110).';
COMMENT ON COLUMN public.passports.expires_at IS 'Availability window end (UTC instant, EXCLUSIVE). NULL = no end bound. Stamping/acquiring blocked when now() >= expires_at (migration 110). Distinct from collector_passports.expires_at (per-copy lifetime).';
COMMENT ON COLUMN public.passports.availability_timezone IS 'IANA zone (e.g. America/Los_Angeles) for DISPLAY and for the designer''s date->instant conversion. Instants are stored in UTC (migration 110).';

-- 2. The one rule -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.passport_is_stampable(
  p_passport_id uuid,
  at            timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  -- Start inclusive, end exclusive. A missing passport row does not block here
  -- (ownership/FK integrity is enforced elsewhere); the window only ever
  -- NARROWS, never invents, a block.
  SELECT COALESCE(
    (SELECT (p.effective_at IS NULL OR at >= p.effective_at)
        AND (p.expires_at   IS NULL OR at <  p.expires_at)
       FROM public.passports p
      WHERE p.id = p_passport_id),
    true
  );
$$;

-- Shared raiser: one message implementation for the "opens"/"ended" errors,
-- formatted in the passport's availability_timezone. HINT carries a machine
-- token so callers (verify-stamp) can map it; the exclusive end is shown as the
-- last valid day ("ended Dec 31", not "Jan 1").
CREATE OR REPLACE FUNCTION public.assert_passport_stampable(p_passport_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_eff timestamptz;
  v_exp timestamptz;
  v_tz  text;
BEGIN
  SELECT effective_at, expires_at, COALESCE(availability_timezone, 'UTC')
    INTO v_eff, v_exp, v_tz
    FROM public.passports WHERE id = p_passport_id;

  IF v_eff IS NOT NULL AND now() < v_eff THEN
    RAISE EXCEPTION 'This passport opens %', to_char(v_eff AT TIME ZONE v_tz, 'FMMon DD, YYYY')
      USING ERRCODE = 'P0001', HINT = 'passport_not_open';
  ELSIF v_exp IS NOT NULL AND now() >= v_exp THEN
    RAISE EXCEPTION 'This passport ended %', to_char((v_exp - interval '1 second') AT TIME ZONE v_tz, 'FMMon DD, YYYY')
      USING ERRCODE = 'P0001', HINT = 'passport_ended';
  END IF;
END $$;

-- 3. Enforcement triggers ---------------------------------------------------
-- 3a. STAMP insert (verify-stamp is the only writer; this is the hard backstop).
--     passport_id via stamps.collector_passport_id -> collector_passports.
CREATE OR REPLACE FUNCTION public.enforce_stamp_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT cp.passport_id INTO v_pid
    FROM public.collector_passports cp
   WHERE cp.id = NEW.collector_passport_id;
  IF v_pid IS NOT NULL THEN
    PERFORM public.assert_passport_stampable(v_pid);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_stamp_window ON public.stamps;
CREATE TRIGGER trg_enforce_stamp_window
  BEFORE INSERT ON public.stamps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stamp_window();

-- 3b. PUNCH insert (consume_stop_qr_token_and_punch is the only writer).
--     passport_id via punches.card_instance_id -> card_instances -> collector_passports.
CREATE OR REPLACE FUNCTION public.enforce_punch_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT cp.passport_id INTO v_pid
    FROM public.card_instances ci
    JOIN public.collector_passports cp ON cp.id = ci.collector_passport_id
   WHERE ci.id = NEW.card_instance_id;
  IF v_pid IS NOT NULL THEN
    PERFORM public.assert_passport_stampable(v_pid);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_punch_window ON public.punches;
CREATE TRIGGER trg_enforce_punch_window
  BEFORE INSERT ON public.punches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_punch_window();

-- 3c. ACQUIRE insert (ensure_collector_passport inserts the copy).
--     Block acquire AFTER the window ends (before effective_at is allowed), and
--     clamp the copy's expires_at to LEAST(copy-duration-expiry, window end).
CREATE OR REPLACE FUNCTION public.enforce_acquire_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_eff timestamptz;
  v_exp timestamptz;
  v_tz  text;
BEGIN
  SELECT effective_at, expires_at, COALESCE(availability_timezone, 'UTC')
    INTO v_eff, v_exp, v_tz
    FROM public.passports WHERE id = NEW.passport_id;

  IF v_exp IS NOT NULL AND now() >= v_exp THEN
    RAISE EXCEPTION 'This passport ended % and can no longer be acquired',
      to_char((v_exp - interval '1 second') AT TIME ZONE v_tz, 'FMMon DD, YYYY')
      USING ERRCODE = 'P0001', HINT = 'passport_ended';
  END IF;

  -- Copy lifetime is the earlier of its own duration-based expiry and the
  -- passport window end. NEW.expires_at is NULL when the design has no
  -- per-copy duration; treat that as unbounded for the LEAST().
  IF v_exp IS NOT NULL THEN
    NEW.expires_at := LEAST(COALESCE(NEW.expires_at, 'infinity'::timestamptz), v_exp);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_acquire_window ON public.collector_passports;
CREATE TRIGGER trg_enforce_acquire_window
  BEFORE INSERT ON public.collector_passports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_acquire_window();
