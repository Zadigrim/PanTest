-- Migration 100: passport expansions — supplemental pages appended to an
-- already-published passport that holders OPT INTO.
--
-- Cardinal safety (per the rulings):
--   • Strictly additive: new pages/stops are new rows; existing stamps/journal
--     reference old stop ids and are never touched.
--   • Opt-in: holders render base pages always; expansion pages ONLY when they
--     have accepted that expansion (collector_passport_expansions). Holders
--     render LIVE rows, so the accept-gate is what keeps expansions opt-in.
--   • Original completion FROZEN to the base stop set: passport-completion
--     (098) now counts ONLY base stops (expansion_id IS NULL). Adding an
--     expansion can never dilute/recompute/un-complete the original or re-arm
--     its prize. Already-minted tokens are untouched (idempotent).
--   • Expansion pages carry only PAGE-specific prizes (existing mechanism);
--     no new passport-level completion target.
--
-- Web tree: passport_pages + collector_passports originate in the mobile tree
-- but are altered from the web tree per the established pattern (e.g. 066). The
-- mobile client consumes expansion_id + acceptances in the next AAB.
--
-- ROLLBACK: drop the two tables + the expansion_id column; restore the 098
-- function body (un-scoped). Additive; modifies no existing row.

-- ── A published expansion batch ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passport_expansions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id  uuid        NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  sequence     integer     NOT NULL,              -- 1, 2, … per passport
  title        text,                              -- holder-facing label
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid        REFERENCES public.profiles(id),
  UNIQUE (passport_id, sequence)
);
CREATE INDEX IF NOT EXISTS passport_expansions_passport_idx
  ON public.passport_expansions (passport_id, sequence);

ALTER TABLE public.passport_expansions ENABLE ROW LEVEL SECURITY;
-- Readable by anyone who can reach the passport (page metadata, not sensitive);
-- writes go through the publish-expansion route (service role).
DROP POLICY IF EXISTS passport_expansions_read ON public.passport_expansions;
CREATE POLICY passport_expansions_read ON public.passport_expansions
  FOR SELECT USING (true);

-- ── Page → expansion scope (NULL = base/original page) ───────────────────────
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS expansion_id uuid REFERENCES public.passport_expansions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS passport_pages_expansion_idx
  ON public.passport_pages (expansion_id);

-- ── Per-holder opt-in acceptance ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collector_passport_expansions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_passport_id uuid        NOT NULL REFERENCES public.collector_passports(id) ON DELETE CASCADE,
  expansion_id          uuid        NOT NULL REFERENCES public.passport_expansions(id) ON DELETE CASCADE,
  accepted_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collector_passport_id, expansion_id)
);
CREATE INDEX IF NOT EXISTS collector_passport_expansions_cp_idx
  ON public.collector_passport_expansions (collector_passport_id);

ALTER TABLE public.collector_passport_expansions ENABLE ROW LEVEL SECURITY;
-- A holder reads + accepts (inserts) ONLY for their own collector_passports.
-- Acceptance is one-way (no delete policy) — opting in is additive.
DROP POLICY IF EXISTS cpe_read_own ON public.collector_passport_expansions;
CREATE POLICY cpe_read_own ON public.collector_passport_expansions
  FOR SELECT USING (
    collector_passport_id IN (
      SELECT id FROM public.collector_passports WHERE user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS cpe_accept_own ON public.collector_passport_expansions;
CREATE POLICY cpe_accept_own ON public.collector_passport_expansions
  FOR INSERT WITH CHECK (
    collector_passport_id IN (
      SELECT id FROM public.collector_passports WHERE user_id = auth.uid()
    )
  );

-- ── Cardinal fix: pin passport-completion to the BASE stop set ───────────────
-- Identical to migration 098 EXCEPT the completion count is restricted to base
-- pages (expansion_id IS NULL). Expansion stops never widen the original
-- completion target; the prize stays frozen to the original stop set.
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
