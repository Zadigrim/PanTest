-- 108: collector badges substrate + the first badge, "Founding Collector".
--
-- The smallest forward-compatible achievement substrate: one generic table and
-- one award function. Phase 1-2 badges (Guide, breadth, Local Legend, …) reuse
-- this table — build the substrate generic, build ONLY this badge.
--
-- Founding Collector: awarded when a collector has stamped EVERY base stop of a
-- passport WHILE that passport is still demo-published (passports.is_demo =
-- true). Demo stamps are marked is_demo and excluded from verified-presence
-- analytics; this badge honors what they represent — the collector walked the
-- route before it went live. Once a passport is promoted (is_demo = false) the
-- window closes automatically (award checks is_demo at call time). One badge
-- per user TOTAL — a founding-era credential, not a repeatable achievement.
--
-- ROLLBACK: drop the trigger + guard fn + award fn, then the table.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collector_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  badge_key   text NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb NOT NULL DEFAULT '{}',
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS collector_badges_user_idx ON public.collector_badges (user_id);

-- ── 2. RLS: collectors read their OWN badges; no client writes ───────────────
ALTER TABLE public.collector_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collector_badges_select_own ON public.collector_badges;
CREATE POLICY collector_badges_select_own ON public.collector_badges
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies: RLS denies all client writes. Writes happen
-- ONLY via award_demo_completion_badge (SECURITY DEFINER, bypasses RLS) or the
-- service role.

-- ── 3. Write guard (loud failure, never a silent no-op) ──────────────────────
-- Unlike the migration-105/107 column guards (which gate ADMIN-written columns
-- on is_platform_admin()), this table's legitimate writer is the award function
-- running as the COLLECTOR — and auth.uid() inside a SECURITY DEFINER function
-- is still the CALLER, so an admin/uid check would reject the real award. So we
-- gate on a transaction-local flag the award function sets, plus the service
-- role (auth.uid() IS NULL, e.g. the backfill below / verify-stamp's service
-- client). Any other write (an authenticated client reaching the table) raises.
CREATE OR REPLACE FUNCTION public.guard_collector_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_setting('app.awarding_badge', true) = '1' OR auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'collector_badges is written only via award_demo_completion_badge or the service role'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_collector_badges ON public.collector_badges;
CREATE TRIGGER trg_guard_collector_badges
  BEFORE INSERT OR UPDATE OR DELETE ON public.collector_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_collector_badges();

-- ── 4. Award function ────────────────────────────────────────────────────────
-- Returns true ONLY when this call inserts the badge. false otherwise (not
-- eligible, or already held). Idempotent + concurrency-safe: the pre-check plus
-- ON CONFLICT DO NOTHING mean two racing stamp writes yield exactly one row.
--
-- Grants mirror generate_passport_completion_token (mig 104/106): granted to
-- authenticated + service_role, protected by the internal caller guard — a
-- client can only ever award ITSELF a badge it has actually earned (is_demo +
-- full completion re-checked here), so granting authenticated is safe.
CREATE OR REPLACE FUNCTION public.award_demo_completion_badge(
  p_user_id uuid,
  p_passport_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_is_demo   boolean;
  v_title     text;
  v_total     int;
  v_remaining int;
BEGIN
  -- Caller guard (mirrors generate_passport_completion_token, mig 104/106):
  -- a client may only act for THEMSELVES; service role / admin unrestricted.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to award a badge for another user'
      USING ERRCODE = '42501';
  END IF;

  -- (a) passport exists AND is demo-published AT CALL TIME.
  SELECT is_demo, title INTO v_is_demo, v_title
    FROM public.passports WHERE id = p_passport_id;
  IF NOT FOUND OR v_is_demo IS DISTINCT FROM true THEN
    RETURN false;
  END IF;

  -- (c) not already held (fast exit; ON CONFLICT is the concurrency backstop).
  IF EXISTS (
    SELECT 1 FROM public.collector_badges
    WHERE user_id = p_user_id AND badge_key = 'founding_collector'
  ) THEN
    RETURN false;
  END IF;

  -- (b) every BASE stop stamped — SAME completeness definition + shape as
  -- generate_passport_completion_token (mig 106): base pages only.
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

  IF v_total = 0 OR v_remaining > 0 THEN
    RETURN false;
  END IF;

  -- Award. Flag lets the guard trigger accept this write (see guard above).
  PERFORM set_config('app.awarding_badge', '1', true);
  INSERT INTO public.collector_badges (user_id, badge_key, metadata)
  VALUES (
    p_user_id, 'founding_collector',
    jsonb_build_object('passport_id', p_passport_id, 'passport_title', v_title, 'era', 'beta')
  )
  ON CONFLICT (user_id, badge_key) DO NOTHING;

  RETURN FOUND; -- true only if this INSERT actually wrote a row
END;
$$;

REVOKE ALL ON FUNCTION public.award_demo_completion_badge(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_demo_completion_badge(uuid, uuid)
  TO authenticated, service_role;

-- ── 5. Backfill (one-time) ───────────────────────────────────────────────────
-- Award to everyone who has ALREADY completed a currently-demo passport.
-- awarded_at = the user's LATEST stamp on the qualifying passport (not now()).
-- One badge per user TOTAL: a user who completed several demo passports gets a
-- single badge, dated to their EARLIEST founding moment (DISTINCT ON + the
-- UNIQUE constraint). Runs as the migration role (auth.uid() IS NULL → the
-- guard permits it). Zero awarded is a valid outcome.
DO $backfill$
DECLARE
  v_n int;
BEGIN
  WITH eligible AS (
    SELECT
      cp.user_id,
      p.id    AS passport_id,
      p.title AS passport_title,
      max(st.verified_at) AS awarded_at
    FROM public.passports p
    JOIN public.passport_pages pp ON pp.passport_id = p.id AND pp.expansion_id IS NULL
    JOIN public.stops s           ON s.page_id = pp.id
    JOIN public.collector_passports cp ON cp.passport_id = p.id
    JOIN public.stamps st         ON st.stop_id = s.id AND st.user_id = cp.user_id
    WHERE p.is_demo = true
    GROUP BY cp.user_id, p.id, p.title
    HAVING count(DISTINCT s.id) = (
      SELECT count(*) FROM public.stops s2
      JOIN public.passport_pages pp2 ON pp2.id = s2.page_id
      WHERE pp2.passport_id = p.id AND pp2.expansion_id IS NULL
    )
  ),
  ins AS (
    INSERT INTO public.collector_badges (user_id, badge_key, awarded_at, metadata)
    SELECT DISTINCT ON (e.user_id)
      e.user_id, 'founding_collector', e.awarded_at,
      jsonb_build_object('passport_id', e.passport_id, 'passport_title', e.passport_title, 'era', 'beta')
    FROM eligible e
    ORDER BY e.user_id, e.awarded_at ASC  -- earliest founding moment wins
    ON CONFLICT (user_id, badge_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  RAISE NOTICE 'Founding Collector backfill: awarded % badge(s)', v_n;
END;
$backfill$;

-- ── SQL guard/behavior test (run manually against a scratch DB) ──────────────
-- (1) A client (authenticated) INSERT is rejected loudly, never a silent no-op:
--       SET request.jwt.claims TO '{"sub":"<some-uuid>","role":"authenticated"}';
--       INSERT INTO public.collector_badges (user_id, badge_key)
--         VALUES ('<some-uuid>', 'founding_collector');
--     -> ERROR 42501 "collector_badges is written only via ..."
--     (RLS also denies it; the trigger makes the failure explicit.)
--
-- (2) Calling the award twice yields exactly ONE row:
--       SELECT public.award_demo_completion_badge('<user>','<demo_passport>'); -- true (first)
--       SELECT public.award_demo_completion_badge('<user>','<demo_passport>'); -- false (already held)
--       SELECT count(*) FROM public.collector_badges
--         WHERE user_id = '<user>' AND badge_key = 'founding_collector';        -- 1
--
-- (3) The function refuses on a non-demo passport (returns false, writes nothing):
--       UPDATE public.passports SET is_demo = false WHERE id = '<passport>';    -- (admin/service)
--       SELECT public.award_demo_completion_badge('<user>','<passport>');       -- false
