-- Migration 060: stop_comments
--
-- Educators leaving notes on shared educational stops:
-- "ran this with my 4th graders — pair it with the Hatchet
-- unit", "the parking lot at the south entrance is closed
-- on weekends", etc. The Stop Library's first cross-
-- institution free-text UGC surface, so the writer
-- population is gated TIGHTER than acknowledgments:
--
--   * Anyone authenticated SELECTs (comments are public on
--     shared stops — they're part of the stop's credibility
--     surface).
--   * Only institutional educators + platform admins INSERT.
--     "Institutional educator" = a row exists in either
--     `institutions` keyed on the user's id (manager case)
--     OR `employee_authorizations` keyed on user_id
--     (employee case).
--   * Authors UPDATE their own body (and the route stamps
--     edited_at).
--   * Authors DELETE their own; platform admin may DELETE
--     any (v1 moderation — a report/flag mechanism is in
--     the known-issues register as a hard gate before any
--     multi-institution rollout).
--
-- v1 NON-FEATURES (intentional, do not add without spec):
--   * No replies / threads.
--   * No reactions.
--   * No @-mentions.
--   * No notifications.
--   * No soft-delete: DELETE actually deletes (RLS makes
--     the audit trail; if a row is gone, it was either the
--     author or an admin).
--
-- The "Used this in a passport" badge on a comment is NOT
-- stored here. It's derived live from stop_imports
-- (migration 058): if the comment's author_id is also an
-- importer_id with source_stop_id = this comment's stop_id,
-- the UI renders the chip. Authors cannot toggle it — that's
-- what makes it trustworthy vouching.
--
-- ROLLBACK: DROP TABLE. The drawer's Comments section
-- gracefully degrades — the GET endpoint returns 404 and
-- the section hides itself.

CREATE TABLE IF NOT EXISTS public.stop_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id     uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz NULL,
  CONSTRAINT stop_comments_body_length
    CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS stop_comments_stop_idx
  ON public.stop_comments (stop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stop_comments_author_idx
  ON public.stop_comments (author_id);

ALTER TABLE public.stop_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated reader. Comments on shared stops
-- are part of the stop's public surface, so we don't
-- restrict reads.
DROP POLICY IF EXISTS "stop_comments_read" ON public.stop_comments;
CREATE POLICY "stop_comments_read" ON public.stop_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: writer-gated. Three preconditions:
--   1. author_id = auth.uid() — you only post as yourself.
--   2. stop must be shared (mirrors stop_acknowledgments_insert).
--   3. caller is institutional (manager OR employee) OR a
--      platform admin. The OR-chain is inline here rather
--      than a helper function so the policy is self-
--      contained for future audits.
DROP POLICY IF EXISTS "stop_comments_insert" ON public.stop_comments;
CREATE POLICY "stop_comments_insert" ON public.stop_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stops s
      WHERE s.id = stop_id AND s.is_shared = true
    )
    AND (
         EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.employee_authorizations ea WHERE ea.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true)
    )
  );

-- UPDATE: authors edit their own body. The route is
-- responsible for stamping edited_at; the policy doesn't
-- enforce it because we want an admin-side rewrite path
-- (if it ever lands) to be able to clean up a comment
-- without lying about the edit time.
DROP POLICY IF EXISTS "stop_comments_update" ON public.stop_comments;
CREATE POLICY "stop_comments_update" ON public.stop_comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- DELETE: author OR platform admin. Two-prong policy keeps
-- the admin moderation path out of band — an admin removing
-- a comment doesn't need to claim authorship.
DROP POLICY IF EXISTS "stop_comments_delete" ON public.stop_comments;
CREATE POLICY "stop_comments_delete" ON public.stop_comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true
    )
  );
