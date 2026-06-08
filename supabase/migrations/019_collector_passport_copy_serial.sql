-- Migration 019: collector_passports per-copy serial + expiry — copy-side (M2 follow-up)
--
-- Mobile-tree migration. Hosts the per-copy columns + the
-- ensure_collector_passport function the three acquisition write
-- paths call. Companion to web-tree 070 which holds the passport-
-- level columns and the atomic allocator.
--
-- DEPLOY ORDER: this runs AFTER web-tree 070. The
-- ensure_collector_passport function references the
-- allocate_copy_number function from 070; it would error at
-- creation if 070 hadn't run.
--
-- ADDED COLUMNS — collector_passports
--
--   copy_number  integer NULL
--     The holder's serial within this passport's run. Set at
--     INSERT by ensure_collector_passport via the
--     allocate_copy_number atomic allocator (web-tree 070).
--     NULL only for pre-function rows; the function always
--     populates it for rows it creates.
--
--   expires_at   timestamptz NULL
--     Concrete expiry date. Computed at INSERT as
--     acquired_at + passports.expiry_duration_days when the
--     design has a duration, else NULL ("No expiry"). Storing
--     the concrete value means a later edit to the design's
--     expiry_duration_days NEVER retroactively expires
--     existing copies — those copies keep the expires_at they
--     received at acquisition.
--
-- UNIQUENESS
--
--   UNIQUE(passport_id, copy_number) — partial WHERE copy_number
--   IS NOT NULL. Enforces no two copies of the same passport
--   share a number. The partial form tolerates pre-function
--   NULL rows (zero today; defensive).
--
-- ensure_collector_passport(p_user_id, p_passport_id)
--   SECURITY DEFINER. Idempotent: returns the existing row if
--   one already exists for (p_user_id, p_passport_id); otherwise
--   allocates copy_number via allocate_copy_number, computes
--   expires_at from passports.expiry_duration_days +
--   acquired_at (now()), INSERTs, returns the result.
--
--   The three acquisition write paths call this function:
--     - okujiKobo/app/api/acquire (web free-acquire)
--     - okujiKobo/app/api/webhook/stripe (web Stripe webhook)
--     - mobile hooks/usePassport.ts acquirePassport()
--
--   The function returns the canonical per-copy id + copy_number
--   + expires_at the caller can echo back.
--
-- BACKFILL — every existing collector_passports row gets a
-- copy_number via ROW_NUMBER() OVER (PARTITION BY passport_id
-- ORDER BY acquired_at, id). With zero users this is a no-op;
-- included for replay safety.
--
-- ROLLBACK: DROP FUNCTION ensure_collector_passport.
-- ALTER TABLE collector_passports DROP COLUMN copy_number,
-- DROP COLUMN expires_at. The mirror-insert code paths and
-- web-tree 070 must roll back first.

-- ─── Columns ────────────────────────────────────────────────────
ALTER TABLE public.collector_passports
  ADD COLUMN IF NOT EXISTS copy_number integer NULL,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz NULL;

-- ─── Backfill ──────────────────────────────────────────────────
-- Assigns copy_number to every existing row by acquisition order
-- per passport. Zero users today → zero rows updated. Defensive
-- for any replay against a non-empty DB.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY passport_id
                            ORDER BY acquired_at, id) AS rn
    FROM public.collector_passports
   WHERE copy_number IS NULL
)
UPDATE public.collector_passports cp
   SET copy_number = ranked.rn
  FROM ranked
 WHERE cp.id = ranked.id;

-- ─── UNIQUE — partial for NULL tolerance ────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS collector_passports_passport_copy_number_key
  ON public.collector_passports (passport_id, copy_number)
  WHERE copy_number IS NOT NULL;

-- ─── ensure_collector_passport ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_collector_passport(
  p_user_id     uuid,
  p_passport_id uuid
)
RETURNS TABLE(
  id          uuid,
  copy_number integer,
  expires_at  timestamptz,
  acquired_at timestamptz,
  is_new      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing   public.collector_passports%ROWTYPE;
  v_allocated  integer;
  v_duration   integer;
  v_expires_at timestamptz;
  v_now        timestamptz := now();
  v_new        public.collector_passports%ROWTYPE;
BEGIN
  -- Idempotent fast-path: existing row.
  SELECT * INTO v_existing
    FROM public.collector_passports
   WHERE user_id = p_user_id
     AND passport_id = p_passport_id;

  IF FOUND THEN
    id          := v_existing.id;
    copy_number := v_existing.copy_number;
    expires_at  := v_existing.expires_at;
    acquired_at := v_existing.acquired_at;
    is_new      := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- New acquisition path.
  v_allocated := public.allocate_copy_number(p_passport_id);

  SELECT expiry_duration_days INTO v_duration
    FROM public.passports
   WHERE id = p_passport_id;

  IF v_duration IS NOT NULL THEN
    v_expires_at := v_now + make_interval(days => v_duration);
  ELSE
    v_expires_at := NULL;
  END IF;

  INSERT INTO public.collector_passports
    (user_id, passport_id, acquired_at, copy_number, expires_at)
  VALUES
    (p_user_id, p_passport_id, v_now, v_allocated, v_expires_at)
  RETURNING * INTO v_new;

  id          := v_new.id;
  copy_number := v_new.copy_number;
  expires_at  := v_new.expires_at;
  acquired_at := v_new.acquired_at;
  is_new      := true;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_collector_passport(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_collector_passport(uuid, uuid) TO authenticated;
