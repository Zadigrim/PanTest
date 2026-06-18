-- Migration 098: passport-COMPLETION prize, reusing the page-completion
-- redemption mechanism (no parallel reward system).
--
-- Page-completion prizes already flow: page complete → completion_tokens row
-- (page_id set) → terminal validate/redeem (redeem_completion is page-agnostic,
-- keys on token_code + passport_id). This adds the WHOLE-PASSPORT case:
--   • A passport-level prize definition (passports.completion_prize_*).
--   • completion_tokens.page_id becomes nullable → a token with page_id NULL is
--     a passport-scoped (completion) token; passport_id stays the anchor.
--   • generate_passport_completion_token(): mints that token when all stops
--     across all pages are stamped AND a completion prize is defined. Idempotent.
--     Called server-side by the verify-stamp edge function (no mobile build).
-- Redemption is UNCHANGED — redeem_completion already ignores page_id, so a
-- passport-scoped token redeems through the same terminal flow. The validate
-- route reads the prize from the passport when page_id is NULL.
--
-- ROLLBACK: drop the function + columns; re-add page_id NOT NULL (only after
-- deleting any page_id NULL tokens). Additive; modifies no existing row.

-- ── Passport-level completion prize definition ───────────────────────────────
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS completion_prize_description text,
  ADD COLUMN IF NOT EXISTS completion_prize_value_cents integer;

-- ── Allow passport-scoped completion tokens (page_id NULL) ───────────────────
ALTER TABLE public.completion_tokens
  ALTER COLUMN page_id DROP NOT NULL;

-- ── Mint a passport-completion token (idempotent, gated on a defined prize) ──
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
  -- Only when the passport actually defines a completion prize.
  SELECT completion_prize_description INTO v_prize
    FROM public.passports WHERE id = p_passport_id;
  IF v_prize IS NULL OR btrim(v_prize) = '' THEN RETURN; END IF;

  -- Idempotency: reuse an existing passport-scoped token for this holder.
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

  -- Whole-passport completion: count stops across ALL pages, and how many of
  -- them are not yet stamped by this holder. Require ≥1 stop and 0 remaining.
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
  WHERE pp.passport_id = p_passport_id;

  IF v_total = 0 OR v_remaining > 0 THEN RETURN; END IF;

  RETURN QUERY
    INSERT INTO public.completion_tokens (user_id, passport_id, page_id, token_code)
    VALUES (p_user_id, p_passport_id, NULL,
            public.generate_completion_token_code(p_passport_id))
    RETURNING completion_tokens.id, completion_tokens.token_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_passport_completion_token(uuid, uuid) FROM PUBLIC;
-- authenticated: future client-side trigger if ever needed; service_role: the
-- verify-stamp edge function calls it after recording the completing stamp.
GRANT EXECUTE ON FUNCTION public.generate_passport_completion_token(uuid, uuid)
  TO authenticated, service_role;
