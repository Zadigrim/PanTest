-- 091_passport_visibility_review.sql
--
-- Publish-visibility + Studio decency-review gate (net-new; does NOT use
-- or revive share_tokens). Adds two orthogonal columns to passports and
-- tightens the public-read RLS across passports / passport_pages / stops
-- so private and non-approved passports fail closed everywhere at once.
--
-- Capability model (enforced server-side, fail closed):
--   * Free / Pro: cannot publish (already blocked by the migration-045
--     publish gate — personal publish requires Studio; Pro is not Studio).
--   * Studio: may publish public + private; ALL Studio publishes enter
--     review_status='pending' and are hidden until an admin approves.
--   * Institution (proprietor + can_design): may publish public + private;
--     NOT pre-reviewed — auto-approved on publish (live immediately),
--     accountable post-hoc.
--   * Only Studio / Institution can reach a published state, so only they
--     can create private (published-but-hidden, token-redeemable) passports.
--
-- New columns:
--   visibility      'public' | 'private'                  (default 'public')
--   review_status   'pending' | 'approved' | 'rejected'   (default 'pending')
--   reviewed_by / reviewed_at / review_note / review_requested_at (audit)
--
-- Backfill: existing published passports are grandfathered to
-- review_status='approved' so live content is not delisted by this change.
-- New/draft rows default 'pending'; the publish trigger sets the right
-- value on the false->true transition.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

-- Grandfather existing live passports (don't take published content down).
UPDATE public.passports SET review_status = 'approved' WHERE is_published = true;

-- Speed the admin "pending review" queue.
CREATE INDEX IF NOT EXISTS passports_review_pending_idx
  ON public.passports (review_requested_at)
  WHERE review_status = 'pending';

-- ── Publish gate (extends migration 045) ────────────────────────────────
-- Same authorization rules as 045, plus: set review_status on the publish
-- transition by tier. Admin / Institution -> 'approved' (live). Studio
-- personal -> 'pending' (+ review_requested_at) so it publishes but stays
-- hidden until an admin approves. Error messages preserved verbatim.
CREATE OR REPLACE FUNCTION public.enforce_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_admin boolean;
  v_can_design boolean;
  v_studio_active boolean;
BEGIN
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();

  SELECT public.is_platform_admin() INTO v_admin;
  IF v_admin IS TRUE THEN
    NEW.review_status := 'approved';
    RETURN NEW;
  END IF;

  IF NEW.proprietor_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = v_actor
         AND ea.institution_id = NEW.proprietor_id
         AND ea.can_design = TRUE
    ) INTO v_can_design;
    IF v_can_design IS TRUE THEN
      -- Institution: not pre-reviewed; live on publish.
      NEW.review_status := 'approved';
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Publishing this passport requires "can_design" at the owning institution.'
      USING ERRCODE = '42501';
  END IF;

  SELECT (
    p.studio_status = 'active'
    AND (p.studio_expires_at IS NULL OR p.studio_expires_at > now())
  )
    INTO v_studio_active
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_studio_active IS TRUE THEN
    -- Studio: requires decency review before going live.
    NEW.review_status := 'pending';
    NEW.review_requested_at := now();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Publishing a personal passport to the marketplace requires Studio. Ask an admin for a Studio comp at /access/comp-subscriptions, or upgrade when Studio billing is live.'
    USING ERRCODE = '42501';
END;
$$;

-- ── Admin review RPCs (single mechanism: is_platform_admin) ─────────────
-- These set review_status WITHOUT touching is_published, so the publish
-- trigger does not re-fire. SECURITY DEFINER bypasses RLS to write the row.
CREATE OR REPLACE FUNCTION public.approve_passport_review(p_passport_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to review passports' USING ERRCODE = '42501';
  END IF;
  UPDATE public.passports
     SET review_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'passport not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_passport_review(p_passport_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to review passports' USING ERRCODE = '42501';
  END IF;
  UPDATE public.passports
     SET review_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   WHERE id = p_passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'passport not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_passport_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_passport_review(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_passport_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_passport_review(uuid, text) TO authenticated;

-- ── Public-read RLS: fail closed on private / non-approved ──────────────
-- The public branch now requires published AND public AND approved.
-- Creators still read their own (any state); admins read everything;
-- holders read acquired passports via passports_acquired_read (062),
-- unchanged — so a token-redeemed private passport stays readable to its
-- holder while hidden from everyone else.
DROP POLICY IF EXISTS "passports_public_read" ON public.passports;
CREATE POLICY "passports_public_read" ON public.passports
  FOR SELECT USING (
    (is_published = true AND visibility = 'public' AND review_status = 'approved')
    OR creator_id = auth.uid()
    OR public.is_admin() = true
  );

-- Pages + stops public-read are gated on the owning passport's published
-- state; tighten them identically so a private passport's pages/stops
-- aren't readable by id even though the passport row is hidden. Holders
-- keep access via pages_acquired_read / stops_acquired_read (062); creators
-- via pages_creator / stops_creator (FOR ALL).
DROP POLICY IF EXISTS "pages_public_read" ON public.passport_pages;
CREATE POLICY "pages_public_read" ON public.passport_pages
  FOR SELECT USING (
    passport_id IN (
      SELECT id FROM public.passports
       WHERE is_published = true AND visibility = 'public' AND review_status = 'approved'
    )
    OR passport_id IN (SELECT id FROM public.passports WHERE creator_id = auth.uid())
    OR public.is_admin() = true
  );

DROP POLICY IF EXISTS "stops_public_read" ON public.stops;
CREATE POLICY "stops_public_read" ON public.stops
  FOR SELECT USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
        JOIN public.passports p ON p.id = pp.passport_id
       WHERE p.is_published = true AND p.visibility = 'public' AND p.review_status = 'approved'
    )
    OR public.is_admin() = true
  );
