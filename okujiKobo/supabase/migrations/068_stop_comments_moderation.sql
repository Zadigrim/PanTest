-- Migration 068: stop_comments moderation (KI-07)
--
-- Adds the minimum-viable moderation surface for the Stop Library
-- UGC: any signed-in user can report a comment; a platform admin
-- can hide / unhide. No queue, no counting (one report is enough),
-- no automated review. Documented exactly that scope in the KI-07
-- register entry — over-claiming the moderation surface was the
-- KI-01 lesson.
--
-- Schema additions:
--   hidden_at   timestamptz NULL  — when an admin hid the comment
--   hidden_by   uuid REFERENCES public.profiles(id) NULL — which admin
--   reported_at timestamptz NULL  — first time any user reported it
--                                   (no counting; one report surfaces it)
--
-- RLS changes:
--   SELECT — non-admin readers exclude rows where hidden_at IS NOT NULL,
--            EXCEPT the comment's own author (so authors see their
--            comment marked-hidden rather than vanishing without
--            explanation). Platform admin sees everything (the existing
--            "admin sees all" path stays the only admin gate per
--            CLAUDE.md invariant #4).
--
-- Write semantics live in SECURITY DEFINER functions so the route
-- layer doesn't have to think about column-scoped RLS:
--   report_stop_comment(uuid)         — any signed-in user; sets
--                                       reported_at if currently null
--   set_stop_comment_hidden(uuid, bool) — admin only; sets / clears
--                                       hidden_at + hidden_by atomically
--
-- The two API routes built alongside this migration call these
-- functions. The reporter / admin checks are concentrated in PL/pgSQL
-- where they're verifiable in one place.
--
-- ROLLBACK: drop the two functions, then drop the three columns.
-- The SELECT policy reverts cleanly because the new predicate degrades
-- safely (an admin seeing a row with no hidden_at column would simply
-- get "false" on the IS NOT NULL test).

-- ─── Schema ────────────────────────────────────────────────────────
ALTER TABLE public.stop_comments
  ADD COLUMN IF NOT EXISTS hidden_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS hidden_by   uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz NULL;

-- Partial index — speeds the admin's "moderation needs attention"
-- read (reported-but-not-hidden) without bloating the main index.
CREATE INDEX IF NOT EXISTS stop_comments_reported_idx
  ON public.stop_comments (reported_at)
  WHERE reported_at IS NOT NULL AND hidden_at IS NULL;

-- ─── RLS: SELECT replacement ───────────────────────────────────────
-- Replaces the existing "any authenticated reader" policy. Hidden
-- rows are filtered for everyone EXCEPT the author and platform
-- admins. Authors keep visibility so the UI can render "your
-- comment was hidden by moderators" inline; admins keep full
-- visibility for moderation work.
DROP POLICY IF EXISTS "stop_comments_read" ON public.stop_comments;
CREATE POLICY "stop_comments_read" ON public.stop_comments
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      hidden_at IS NULL
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_platform_admin = true
      )
    )
  );

-- Existing INSERT / UPDATE / DELETE policies (writer-population,
-- author-edits, author-or-admin-deletes) UNCHANGED. The new write
-- semantics for moderation flow through SECURITY DEFINER functions
-- below, not through these policies.

-- ─── Write semantics: report ───────────────────────────────────────
-- Any signed-in user may report any comment. Sets reported_at to
-- now() iff currently null — repeated reports don't update the
-- timestamp (we don't count or queue per spec; one report is the
-- whole surface). Returns the resulting reported_at so the caller
-- can echo "Reported at …" if useful.
--
-- SECURITY DEFINER + an explicit auth.uid() IS NOT NULL check
-- because we're writing a column the caller wouldn't otherwise
-- have UPDATE access to via the row-level policy.
CREATE OR REPLACE FUNCTION public.report_stop_comment(p_comment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reported_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.stop_comments
     SET reported_at = COALESCE(reported_at, now())
   WHERE id = p_comment_id
  RETURNING reported_at INTO v_reported_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_reported_at;
END;
$$;

REVOKE ALL ON FUNCTION public.report_stop_comment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_stop_comment(uuid) TO authenticated;

-- ─── Write semantics: hide / unhide ────────────────────────────────
-- Admin-only. Setting p_hidden = true stamps hidden_at = now() and
-- hidden_by = the caller; setting it false clears both. Idempotent.
-- Returns the resulting hidden_at (NULL when unhidden).
--
-- The is_platform_admin check is read DIRECTLY against profiles
-- inside the function body — single mechanism per CLAUDE.md
-- invariant #4. No parallel moderation-role mechanism.
CREATE OR REPLACE FUNCTION public.set_stop_comment_hidden(
  p_comment_id uuid,
  p_hidden     bool
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin bool;
  v_hidden_at       timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_platform_admin INTO v_caller_is_admin
    FROM public.profiles WHERE id = auth.uid();

  IF v_caller_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Platform admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_hidden THEN
    UPDATE public.stop_comments
       SET hidden_at = COALESCE(hidden_at, now()),
           hidden_by = COALESCE(hidden_by, auth.uid())
     WHERE id = p_comment_id
    RETURNING hidden_at INTO v_hidden_at;
  ELSE
    UPDATE public.stop_comments
       SET hidden_at = NULL,
           hidden_by = NULL
     WHERE id = p_comment_id
    RETURNING hidden_at INTO v_hidden_at;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_hidden_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_stop_comment_hidden(uuid, bool) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_stop_comment_hidden(uuid, bool) TO authenticated;
