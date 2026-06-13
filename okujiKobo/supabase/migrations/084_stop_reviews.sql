-- Migration 084: stop_reviews (M-Review) — verified-visitor, adults-only
-- public reviews on stops.
--
-- This is a NEW collector-facing UGC surface, distinct from BOTH:
--   * the private journal (journal_entries, mobile migration 001 —
--     RLS-private to the author, "Okuji never reads journal content"),
--     which is UNTOUCHED by this migration; and
--   * the Stop Library educator UGC (stop_comments / stop_ratings,
--     migrations 060/061), whose writer population is institutional
--     EDUCATORS on shared stops. Reviews are written by COLLECTORS who
--     earned the stamp for the stop. Different writer population, different
--     visibility, different gate — hence a new table, not an extension.
--
-- LEAST-LIABILITY DESIGN (decisions locked with Nathan, 2026-06-13):
--   * Adults only. Posting a review requires a one-time 18+ self-
--     attestation stored as profiles.adult_attested_at (a TIMESTAMP that
--     doubles as the boolean — NULL = not attested). NO date-of-birth is
--     collected or read here; the dormant profiles.date_of_birth column is
--     left exactly as-is. Under-13 collectors are assumed not to use the
--     app at all (printed-PDF path), so no DOB gate is wired.
--   * Fail closed: no attestation -> no review. Enforced inside
--     submit_stop_review (SECURITY DEFINER), not left to the client.
--   * Verified visitors only: a stamps row for (auth.uid(), stop_id) is
--     required. Self-reported stamps MAY review (they are subject to the
--     same moderation as any other review); we do not exclude them.
--   * Hard-disable for known-minor institutional context (option b): if the
--     stop's operating institution is a youth/education type, reviews are
--     disabled for that stop regardless of attestation. This is the only
--     "institutional context" signal that exists — institution_type attaches
--     to the stop's operator (stops -> passport_pages -> passports.
--     proprietor_id -> institutions.institution_type), NOT to the reviewer,
--     so it over-blocks adults at those stops by design. Collectors keep
--     their private journal on those stops; only the public review is gated.
--
-- ATTRIBUTION: minimal and SNAPSHOTTED. Cross-user reads of profiles are
-- RLS-blocked (profiles_own = FOR ALL USING auth.uid() = id), so a viewer
-- cannot resolve another collector's display_name at read time. We therefore
-- denormalize the display name onto the row at write time (stop_reviews.
-- attribution). The UI pairs it with a fixed "Verified visitor" label and
-- discloses the exact public string to the author before posting. No handle
-- system exists in this schema; display_name is the public name already used
-- on other collector surfaces (e.g. accolades).
--
-- MODERATION: reuses the KI-07 pattern verbatim (migration 068) — report_*
-- / set_*_hidden SECURITY DEFINER functions, hidden_at/hidden_by/reported_at
-- columns, hidden rows excluded from non-admin reads AND from the average.
-- No queue, no counting; one report surfaces it. is_platform_admin (read
-- directly against profiles) is the only admin gate, per CLAUDE.md invariant
-- #4. No parallel moderation mechanism.
--
-- RATINGS: 1-5 int, one review per (stop, author). The per-stop average
-- (stop_review_summary) excludes hidden rows: hidden = text hidden AND rating
-- dropped from the average, in one place.
--
-- ROLLBACK: drop the four functions, drop the table, drop the
-- profiles.adult_attested_at column. The mobile review surface degrades
-- gracefully — the RPCs 404 and the section hides itself.

-- ─── Attestation column (boolean-via-timestamp; NOT a birthdate) ───────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adult_attested_at timestamptz NULL;

-- ─── Schema ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stop_reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id      uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  author_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating       int         NOT NULL,
  body         text        NULL,
  -- Snapshot of the author's display_name at post time (see header).
  attribution  text        NOT NULL,
  hidden_at    timestamptz NULL,
  hidden_by    uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_at  timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  edited_at    timestamptz NULL,
  UNIQUE (stop_id, author_id),
  CONSTRAINT stop_reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT stop_reviews_body_length  CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS stop_reviews_stop_idx
  ON public.stop_reviews (stop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stop_reviews_author_idx
  ON public.stop_reviews (author_id);
-- Partial index — admin "needs attention" read (reported-but-not-hidden).
CREATE INDEX IF NOT EXISTS stop_reviews_reported_idx
  ON public.stop_reviews (reported_at)
  WHERE reported_at IS NOT NULL AND hidden_at IS NULL;

ALTER TABLE public.stop_reviews ENABLE ROW LEVEL SECURITY;

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- SELECT: any authenticated reader, EXCEPT hidden rows are filtered for
-- everyone but the author (so they see "your review was hidden" inline) and
-- platform admins (moderation). Mirrors stop_comments_read (migration 068).
DROP POLICY IF EXISTS "stop_reviews_read" ON public.stop_reviews;
CREATE POLICY "stop_reviews_read" ON public.stop_reviews
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

-- No INSERT policy: direct inserts are denied. All writes flow through
-- submit_stop_review (SECURITY DEFINER) so the full gate (attestation +
-- verified-visitor + not-youth-institution) and the attribution snapshot
-- live in one verifiable place — the collector cannot read institutions
-- under RLS, so the youth-institution check cannot live in a row policy.

-- DELETE: an author may remove their own review. Admin removal is a HIDE
-- (set_stop_review_hidden), not a delete, so the moderation record persists.
DROP POLICY IF EXISTS "stop_reviews_delete" ON public.stop_reviews;
CREATE POLICY "stop_reviews_delete" ON public.stop_reviews
  FOR DELETE
  USING (author_id = auth.uid());

-- ─── Attestation: one-time 18+ affirmation ───────────────────────────────
-- Sets profiles.adult_attested_at to now() iff currently null. Never clears
-- it. Stores NO birthdate. Returns the resulting timestamp.
CREATE OR REPLACE FUNCTION public.attest_adult()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attested_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
     SET adult_attested_at = COALESCE(adult_attested_at, now())
   WHERE id = auth.uid()
  RETURNING adult_attested_at INTO v_attested_at;

  RETURN v_attested_at;
END;
$$;

REVOKE ALL ON FUNCTION public.attest_adult() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attest_adult() TO authenticated;

-- ─── Eligibility: is the public review surface enabled on this stop? ──────
-- FALSE iff the stop's operating institution is a youth/education type
-- (option b hard-disable). The collector cannot read institutions under RLS,
-- so this is SECURITY DEFINER and client-callable to drive the UI. A stop
-- with no proprietor (individual creator) or a non-youth institution returns
-- TRUE (fail-open for reviews; we only disable on a positively-identified
-- youth institution).
CREATE OR REPLACE FUNCTION public.stop_reviews_enabled(p_stop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM public.stops s
      JOIN public.passport_pages pp ON pp.id = s.page_id
      JOIN public.passports      pa ON pa.id = pp.passport_id
      JOIN public.institutions   i  ON i.id  = pa.proprietor_id
     WHERE s.id = p_stop_id
       AND i.institution_type IN (
         'k12_school',
         'after_school_program',
         'youth_development',
         'homeschool_cooperative',
         'childrens_museum'
       )
  );
$$;

REVOKE ALL ON FUNCTION public.stop_reviews_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_reviews_enabled(uuid) TO authenticated;

-- ─── Write: submit (create or edit) a review ─────────────────────────────
-- The single write path. Enforces the full gate and snapshots attribution.
-- Upsert on (stop_id, author_id): editing re-checks the gate and stamps
-- edited_at, but PRESERVES any moderation state (a hidden/reported review
-- stays hidden/reported when its author edits it). Returns the review id.
CREATE OR REPLACE FUNCTION public.submit_stop_review(
  p_stop_id uuid,
  p_rating  int,
  p_body    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_attribution  text;
  v_review_id    uuid;
  v_clean_body   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Fail closed: adult attestation required.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_uid AND adult_attested_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Adult attestation required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verified visitor: a stamp for this stop. Self-reported stamps allowed.
  IF NOT EXISTS (
    SELECT 1 FROM public.stamps
     WHERE user_id = v_uid AND stop_id = p_stop_id
  ) THEN
    RAISE EXCEPTION 'Only verified visitors can review this stop'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Hard-disable on youth/education institutional context.
  IF NOT public.stop_reviews_enabled(p_stop_id) THEN
    RAISE EXCEPTION 'Reviews are disabled for this stop'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Snapshot the author's public display name.
  SELECT COALESCE(NULLIF(btrim(display_name), ''), 'Verified visitor')
    INTO v_attribution
    FROM public.profiles WHERE id = v_uid;

  -- Normalize empty body to NULL (text is optional; rating is not).
  v_clean_body := NULLIF(btrim(COALESCE(p_body, '')), '');

  INSERT INTO public.stop_reviews (stop_id, author_id, rating, body, attribution)
  VALUES (p_stop_id, v_uid, p_rating, v_clean_body, v_attribution)
  ON CONFLICT (stop_id, author_id) DO UPDATE
    SET rating      = EXCLUDED.rating,
        body        = EXCLUDED.body,
        attribution = EXCLUDED.attribution,
        edited_at   = now()
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_stop_review(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_stop_review(uuid, int, text) TO authenticated;

-- ─── Read: per-stop aggregate, excluding hidden ──────────────────────────
-- Authoritative average + count. Excludes hidden rows so a hidden/violating
-- review drops out of the average (and the count). SECURITY DEFINER + an
-- explicit hidden filter so the aggregate is identical for every caller
-- (the author-sees-own-hidden RLS path never skews it).
CREATE OR REPLACE FUNCTION public.stop_review_summary(p_stop_id uuid)
RETURNS TABLE (avg_rating numeric, review_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    round(avg(rating)::numeric, 2) AS avg_rating,
    count(*)::int                  AS review_count
  FROM public.stop_reviews
  WHERE stop_id = p_stop_id
    AND hidden_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.stop_review_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_review_summary(uuid) TO authenticated;

-- ─── Moderation: report (any signed-in user) ─────────────────────────────
-- Mirrors report_stop_comment (migration 068). Sets reported_at iff null;
-- repeated reports don't update it (no counting; one report is the surface).
CREATE OR REPLACE FUNCTION public.report_stop_review(p_review_id uuid)
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

  UPDATE public.stop_reviews
     SET reported_at = COALESCE(reported_at, now())
   WHERE id = p_review_id
  RETURNING reported_at INTO v_reported_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_reported_at;
END;
$$;

REVOKE ALL ON FUNCTION public.report_stop_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_stop_review(uuid) TO authenticated;

-- ─── Moderation: hide / unhide (platform admin only) ─────────────────────
-- Mirrors set_stop_comment_hidden (migration 068). is_platform_admin read
-- directly against profiles — single admin gate, CLAUDE.md invariant #4.
CREATE OR REPLACE FUNCTION public.set_stop_review_hidden(
  p_review_id uuid,
  p_hidden    bool
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
    UPDATE public.stop_reviews
       SET hidden_at = COALESCE(hidden_at, now()),
           hidden_by = COALESCE(hidden_by, auth.uid())
     WHERE id = p_review_id
    RETURNING hidden_at INTO v_hidden_at;
  ELSE
    UPDATE public.stop_reviews
       SET hidden_at = NULL,
           hidden_by = NULL
     WHERE id = p_review_id
    RETURNING hidden_at INTO v_hidden_at;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_hidden_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_stop_review_hidden(uuid, bool) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_stop_review_hidden(uuid, bool) TO authenticated;
