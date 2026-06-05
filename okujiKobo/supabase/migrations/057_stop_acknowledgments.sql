-- Migration 057: stop_acknowledgments
--
-- Educator kudos for shared stops. Distinct from imports
-- (which are a USE signal) — acknowledgments are a CREDIT
-- signal, meant to surface high-quality stops to other
-- educators browsing the Stop Library.
--
-- Semantics:
--   * Any authenticated user may acknowledge any SHARED stop.
--   * One acknowledgment per (user, stop) — enforced by
--     UNIQUE(stop_id, user_id).
--   * Acknowledging is a TOGGLE. The API route inserts on
--     first call and deletes on second; no soft-revoked
--     state, no audit chain.
--   * The Most-acknowledged sort + the card / drawer counts
--     read from a per-stop COUNT(*) — cheap with the
--     stop_id index.
--
-- ROLLBACK: DROP TABLE. The /stops page falls back to
-- omitting the acknowledgments stat; the API route returns
-- 404. No data lost from anywhere else.

CREATE TABLE IF NOT EXISTS public.stop_acknowledgments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id         uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stop_id, user_id)
);

CREATE INDEX IF NOT EXISTS stop_acknowledgments_stop_idx
  ON public.stop_acknowledgments (stop_id);
CREATE INDEX IF NOT EXISTS stop_acknowledgments_user_idx
  ON public.stop_acknowledgments (user_id);

ALTER TABLE public.stop_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated reads the whole table — counts power
-- the public library UI; per-user "have I acknowledged?"
-- check just filters by user_id.
DROP POLICY IF EXISTS "stop_acknowledgments_read" ON public.stop_acknowledgments;
CREATE POLICY "stop_acknowledgments_read" ON public.stop_acknowledgments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: only your own row, only against a stop that's
-- actually shared. The is_shared check is server-side via
-- a subquery so PostgREST can't be coerced into acknowledging
-- a private stop.
DROP POLICY IF EXISTS "stop_acknowledgments_insert" ON public.stop_acknowledgments;
CREATE POLICY "stop_acknowledgments_insert" ON public.stop_acknowledgments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stops s WHERE s.id = stop_id AND s.is_shared = true
    )
  );

-- DELETE: only your own row.
DROP POLICY IF EXISTS "stop_acknowledgments_delete" ON public.stop_acknowledgments;
CREATE POLICY "stop_acknowledgments_delete" ON public.stop_acknowledgments
  FOR DELETE
  USING (user_id = auth.uid());
