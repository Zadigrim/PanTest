-- Migration 104: caller-identity guard on generate_passport_completion_token.
--
-- SECURITY (MEDIUM — pre-tester audit finding M1). The function is SECURITY
-- DEFINER and GRANTed to `authenticated`, but its body never checks the CALLER
-- against p_user_id. An authenticated user could call it with another
-- (already-completed) holder's id and obtain/mint that holder's redeemable
-- completion_tokens.token_code, then drive it through the redemption terminal.
-- The intended caller is the verify-stamp edge function under the service role.
--
-- Fix: reject cross-user calls from authenticated clients, mirroring the guard
-- in ensure_collector_passport. Trusted callers preserved:
--   - service role / SECURITY DEFINER edge path: auth.uid() IS NULL  → allowed.
--   - the user acting on their own completion: auth.uid() = p_user_id → allowed.
--   - a platform admin → allowed.
--
-- The body below is otherwise the migration-100 version verbatim (base-stop
-- completion count excluding expansion pages, idempotent token reuse) and
-- re-issues the same REVOKE/GRANT. Do NOT edit 098/100 — this supersedes them.
--
-- ROLLBACK: CREATE OR REPLACE back to the migration-100 body (without the guard).

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
  v_prize text;
  v_existing record;
  v_remaining int;
  v_total int;
BEGIN
  -- Caller-identity guard (migration 104). A client may only generate a token
  -- for THEMSELVES; the service role (auth.uid() IS NULL) and platform admins
  -- are unrestricted.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to generate a completion token for another user'
      USING ERRCODE = '42501';
  END IF;

  SELECT completion_prize_description INTO v_prize
    FROM public.passports WHERE id = p_passport_id;
  IF v_prize IS NULL OR btrim(v_prize) = '' THEN RETURN; END IF;

  SELECT ct.id, ct.token_code INTO v_existing
    FROM public.completion_tokens ct
    WHERE ct.user_id = p_user_id
      AND ct.passport_id = p_passport_id
      AND ct.page_id IS NULL
    LIMIT 1;
  IF FOUND THEN
    id := v_existing.id; token_code := v_existing.token_code;
    RETURN NEXT; RETURN;
  END IF;

  -- BASE stop set only: expansion pages (expansion_id NOT NULL) are excluded so
  -- adding an expansion can never un-complete the original passport.
  SELECT
    count(*),
    count(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.stamps st
        WHERE st.user_id = p_user_id AND st.stop_id = s.id
      )
    )
    INTO v_total, v_remaining
  FROM public.stops s
  JOIN public.passport_pages pp ON pp.id = s.page_id
  WHERE pp.passport_id = p_passport_id
    AND pp.expansion_id IS NULL;

  IF v_total = 0 OR v_remaining > 0 THEN RETURN; END IF;

  RETURN QUERY
    INSERT INTO public.completion_tokens (user_id, passport_id, page_id, token_code)
    VALUES (p_user_id, p_passport_id, NULL,
            public.generate_completion_token_code(p_passport_id))
    RETURNING completion_tokens.id, completion_tokens.token_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_passport_completion_token(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_passport_completion_token(uuid, uuid)
  TO authenticated, service_role;
