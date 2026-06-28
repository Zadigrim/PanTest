-- 106: user-initiated passport completion + completion threshold.
--
-- Adds a configurable completion THRESHOLD and makes whole-passport completion
-- a USER CHOICE between threshold and 100%, while staying AUTOMATIC at 100%:
--
--   • below threshold        → not eligible (normal collecting)
--   • threshold ≤ stamped <100% → eligible; the holder may OPT to complete
--   • 100% (all base stops)  → auto-completes (existing behavior)
--
-- Completion marks collector_passports.completed_at (previously dead) and fires
-- the completion prize ONCE. It never locks the passport — unstamped stops stay
-- stampable, and stamping after completion neither re-fires nor un-completes.
--
-- SINGLE PATH. complete_passport() is the one completion+prize entry point.
-- generate_passport_completion_token() (called by verify-stamp after every
-- stamp) is re-pointed to DELEGATE to it, but only at 100% — so the auto path
-- fires exactly when all base stops are stamped, and threshold completion is
-- only ever the holder's explicit choice. verify-stamp itself is unchanged.
--
-- Server-enforced: complete_passport re-checks threshold eligibility and the
-- caller's identity/ownership, so a client cannot complete below threshold or
-- fire the prize for someone else. Idempotent: completed_at is set once
-- (never cleared), the prize token is reused if it already exists.
--
-- ROLLBACK: drop complete_passport; CREATE OR REPLACE
-- generate_passport_completion_token back to its migration-100/104 body; drop
-- the column + check.

-- ── 1. Completion threshold (NULL = all base stops = 100%) ──────────────────
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS completion_required_stops integer;

ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_completion_required_stops_check;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_completion_required_stops_check
  CHECK (completion_required_stops IS NULL OR completion_required_stops > 0);

-- ── 2. complete_passport — the single completion + prize path ────────────────
CREATE OR REPLACE FUNCTION public.complete_passport(
  p_user_id uuid,
  p_passport_id uuid
)
RETURNS TABLE(id uuid, token_code text, completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cp           public.collector_passports%ROWTYPE;
  v_base_total   int;
  v_base_stamped int;
  v_required     int;
  v_threshold    int;
  v_prize        text;
  v_existing     record;
  v_token_id     uuid;
  v_token_code   text;
BEGIN
  -- Caller identity guard (mirrors generate_passport_completion_token, mig 104):
  -- a client may only complete for THEMSELVES; service role / admin unrestricted.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to complete a passport for another user'
      USING ERRCODE = '42501';
  END IF;

  -- Holder must actually own the passport.
  SELECT * INTO v_cp
    FROM public.collector_passports
   WHERE user_id = p_user_id AND passport_id = p_passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'passport is not held by this user' USING ERRCODE = '42501';
  END IF;

  -- BASE stop set only (expansion pages excluded, like the prize RPC): total +
  -- how many this holder has stamped.
  SELECT
    count(*),
    count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.stamps st
        WHERE st.user_id = p_user_id AND st.stop_id = s.id
      )
    )
    INTO v_base_total, v_base_stamped
  FROM public.stops s
  JOIN public.passport_pages pp ON pp.id = s.page_id
  WHERE pp.passport_id = p_passport_id
    AND pp.expansion_id IS NULL;

  IF v_base_total = 0 THEN RETURN; END IF;

  -- Threshold = required stops, defaulting to all and clamped to the real count
  -- (a threshold above 100% can never be set this way).
  SELECT completion_required_stops INTO v_required
    FROM public.passports WHERE id = p_passport_id;
  v_threshold := LEAST(COALESCE(v_required, v_base_total), v_base_total);

  -- Server-enforced eligibility.
  IF v_base_stamped < v_threshold THEN
    RAISE EXCEPTION 'completion threshold not met (% of % stamped)', v_base_stamped, v_threshold
      USING ERRCODE = '42501';
  END IF;

  -- Mark complete ONCE — never cleared, so stamping more stops later can't
  -- un-complete the passport.
  IF v_cp.completed_at IS NULL THEN
    UPDATE public.collector_passports SET completed_at = now() WHERE id = v_cp.id;
  END IF;

  -- Fire the completion prize ONCE (idempotent): reuse the existing passport-
  -- scoped token if present. No prize defined → completion still marked.
  SELECT completion_prize_description INTO v_prize
    FROM public.passports WHERE id = p_passport_id;
  IF v_prize IS NULL OR btrim(v_prize) = '' THEN
    completed := true; RETURN NEXT; RETURN;
  END IF;

  SELECT ct.id, ct.token_code INTO v_existing
    FROM public.completion_tokens ct
    WHERE ct.user_id = p_user_id
      AND ct.passport_id = p_passport_id
      AND ct.page_id IS NULL
    LIMIT 1;
  IF FOUND THEN
    id := v_existing.id; token_code := v_existing.token_code; completed := true;
    RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.completion_tokens (user_id, passport_id, page_id, token_code)
  VALUES (p_user_id, p_passport_id, NULL,
          public.generate_completion_token_code(p_passport_id))
  RETURNING completion_tokens.id, completion_tokens.token_code
    INTO v_token_id, v_token_code;

  id := v_token_id; token_code := v_token_code; completed := true;
  RETURN NEXT; RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_passport(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_passport(uuid, uuid) TO authenticated, service_role;

-- ── 3. Re-point the auto path to delegate — fires ONLY at 100% ───────────────
-- verify-stamp calls this after every stamp; it now completes automatically
-- only when all base stops are stamped, routing through the single
-- complete_passport path (which sets completed_at + fires the prize). Threshold
-- completion is never auto — it is the holder's explicit choice. Caller guard
-- preserved from migration 104.
CREATE OR REPLACE FUNCTION public.generate_passport_completion_token(
  p_user_id uuid,
  p_passport_id uuid
)
RETURNS TABLE(id uuid, token_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_base_total     int;
  v_base_remaining int;
  r                record;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to generate a completion token for another user'
      USING ERRCODE = '42501';
  END IF;

  -- AUTO path: only at 100% (no base stops remaining).
  SELECT
    count(*),
    count(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.stamps st
        WHERE st.user_id = p_user_id AND st.stop_id = s.id
      )
    )
    INTO v_base_total, v_base_remaining
  FROM public.stops s
  JOIN public.passport_pages pp ON pp.id = s.page_id
  WHERE pp.passport_id = p_passport_id
    AND pp.expansion_id IS NULL;

  IF v_base_total = 0 OR v_base_remaining > 0 THEN RETURN; END IF;

  -- 100% reached → delegate to the single completion path.
  FOR r IN SELECT cp.id, cp.token_code FROM public.complete_passport(p_user_id, p_passport_id) cp LOOP
    id := r.id; token_code := r.token_code; RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_passport_completion_token(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_passport_completion_token(uuid, uuid)
  TO authenticated, service_role;
