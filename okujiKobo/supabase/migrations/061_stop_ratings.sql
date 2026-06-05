-- Migration 061: stop_ratings  (DORMANT — gated by a feature flag)
--
-- Optional 1-5 star rating mechanic for shared stops. NOT
-- exposed in the UI at ship time — the page reads
-- lib/dashboard/flags.ts → showStopRatings (DEFAULT FALSE)
-- to gate every rating-aware surface.
--
-- Why ship the table now if the UI is dormant?
--   * The schema choice locks in (UNIQUE per rater per stop,
--     int 1-5) so when ratings flip on we don't migrate
--     under live traffic.
--   * Lets us audit the writer-population RLS in tandem
--     with stop_comments (migration 060) — same predicate.
--   * The acknowledgments mechanic (migration 057) and the
--     Used-this badge (live from 058) are the active
--     quality signals; ratings only activate if those prove
--     insufficient at scale.
--
-- Schema mirrors stop_acknowledgments: one writer can rate
-- a given stop at most once. Updating your rating is an
-- UPDATE, not an additional INSERT.
--
-- ROLLBACK: DROP TABLE. The flag-gated UI never reads from
-- it until activated.

CREATE TABLE IF NOT EXISTS public.stop_ratings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id    uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  rater_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating     int         NOT NULL,
  rated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stop_id, rater_id),
  CONSTRAINT stop_ratings_value_range CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS stop_ratings_stop_idx
  ON public.stop_ratings (stop_id);

ALTER TABLE public.stop_ratings ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user (for the future aggregate
-- avg + count display).
DROP POLICY IF EXISTS "stop_ratings_read" ON public.stop_ratings;
CREATE POLICY "stop_ratings_read" ON public.stop_ratings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: same writer-gating as stop_comments (migration
-- 060): only institutional educators + platform admins on
-- shared stops.
DROP POLICY IF EXISTS "stop_ratings_insert" ON public.stop_ratings;
CREATE POLICY "stop_ratings_insert" ON public.stop_ratings
  FOR INSERT
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stops s WHERE s.id = stop_id AND s.is_shared = true
    )
    AND (
         EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.employee_authorizations ea WHERE ea.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true)
    )
  );

-- UPDATE: only your own row (re-rating).
DROP POLICY IF EXISTS "stop_ratings_update" ON public.stop_ratings;
CREATE POLICY "stop_ratings_update" ON public.stop_ratings
  FOR UPDATE
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

-- DELETE: only your own row. No admin override at v1 —
-- there is no UI; rolling back a rating is a regular user
-- action.
DROP POLICY IF EXISTS "stop_ratings_delete" ON public.stop_ratings;
CREATE POLICY "stop_ratings_delete" ON public.stop_ratings
  FOR DELETE
  USING (rater_id = auth.uid());
