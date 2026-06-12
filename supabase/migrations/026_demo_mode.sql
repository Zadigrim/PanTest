-- Migration 026: contained demo mode + server-enforced stamp writes
--
-- Mobile-tree migration (stamps, profiles, collector_passports are
-- mobile-tree-owned, defined in 001/019).
--
-- WHY
--
-- Demo mode defeats the platform's core verification mechanic, so its
-- bypass must be AUTHORIZED SERVER-SIDE and its data MARKED. Three
-- pre-existing holes shape this migration:
--
--   1. stamps RLS was `FOR ALL USING (user_id = auth.uid())` — any
--      authenticated user could INSERT a stamp directly with any
--      verification_method, never calling verify-stamp. Verification
--      was client-trusted at the write path.
--   2. ensure_collector_passport never checked price_cents (payment
--      gating was client-only) and never checked p_user_id against
--      auth.uid().
--   3. profiles RLS lets users UPDATE every column of their own row,
--      so a bare demo flag would be self-grantable.
--
-- WHAT THIS DOES
--
--   • profiles.demo_mode_enabled — reviewer-account demo authorization,
--     settable only by a platform admin (guard trigger below).
--   • is_demo_authorized() — THE demo gate: is_platform_admin() OR the
--     caller's demo_mode_enabled. Single authorization surface; RLS,
--     triggers, edge functions and the acquisition RPC all route
--     through it (mirrors the single-admin-check invariant).
--   • stamps.is_demo + 'demo' verification_method — demo stamps are
--     marked, distinguishable, excluded from analytics, purgeable.
--   • stamps RLS: SELECT/UPDATE/DELETE own (unchanged rights), INSERT
--     revoked — stamps are written ONLY by the verify-stamp edge
--     function (service role) after it verifies GPS/QR/honor or
--     confirms demo authorization. A forged unverified-stamp INSERT
--     from any client is now rejected by the database.
--   • Belt-and-braces stamps trigger: even service-role/SQL writers
--     must keep is_demo consistent with verification_method = 'demo',
--     and a demo row written under a user JWT requires authorization.
--   • collector_passports.acquired_demo — marks demo acquisitions.
--   • ensure_collector_passport (re-created, 021→025 pattern): caller
--     must be the target user; paid passports (price_cents > 0)
--     require p_demo = true AND is_demo_authorized(), and the row is
--     marked acquired_demo. Payment gating is now server-side.
--
-- The currently shipped binary (zero users; Play approval pending)
-- inserted stamps client-side after verify-stamp returned. Once this
-- migration applies, that path is closed; stamping requires the next
-- build, which writes via the function. Accepted per Nathan's D.
--
-- ROLLBACK: drop the triggers + functions, drop the columns, restore
-- the 001 stamps_own policy and the 025 function body. Demo rows (if
-- any) are identifiable via is_demo/acquired_demo first.

-- ── 1. profiles.demo_mode_enabled (admin-settable only) ─────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_mode_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profiles_demo_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.demo_mode_enabled IS DISTINCT FROM OLD.demo_mode_enabled THEN
    -- auth.uid() IS NULL covers service-role / direct-SQL writes
    -- (trusted paths: seeding, admin console SQL).
    IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'demo_mode_enabled may only be changed by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_demo_mode ON public.profiles;
CREATE TRIGGER trg_guard_profiles_demo_mode
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_demo_mode();

-- ── 2. is_demo_authorized() — the single demo gate ──────────────────────────

CREATE OR REPLACE FUNCTION public.is_demo_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.is_platform_admin()
      OR COALESCE(
           (SELECT p.demo_mode_enabled FROM public.profiles p WHERE p.id = auth.uid()),
           false
         );
$$;

REVOKE ALL ON FUNCTION public.is_demo_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_demo_authorized() TO authenticated;

-- ── 3. stamps: is_demo marker + 'demo' verification_method ──────────────────

ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_verification_method_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_verification_method_check
  CHECK (verification_method IN ('qr_gps','gps_only','employee','self_reported','demo'));

-- Demo rows must say so both ways: is_demo ⟺ method 'demo'. A demo
-- stamp can never masquerade as qr_gps/gps_only, and a 'demo'-method
-- row can never slip in unmarked.
CREATE OR REPLACE FUNCTION public.guard_stamps_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.is_demo IS DISTINCT FROM (NEW.verification_method = 'demo') THEN
    RAISE EXCEPTION 'stamps.is_demo must match verification_method = ''demo'''
      USING ERRCODE = '23514';
  END IF;
  -- Demo stamps written under a user JWT require demo authorization.
  -- (The verify-stamp function writes via service role after checking
  -- the caller's JWT; auth.uid() IS NULL there.)
  IF NEW.is_demo AND auth.uid() IS NOT NULL AND NOT public.is_demo_authorized() THEN
    RAISE EXCEPTION 'demo stamps require demo authorization'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_stamps_demo ON public.stamps;
CREATE TRIGGER trg_guard_stamps_demo
  BEFORE INSERT OR UPDATE ON public.stamps
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_stamps_demo();

-- ── 4. stamps RLS: close the client INSERT path ─────────────────────────────
-- Same rights as the old stamps_own FOR ALL policy minus INSERT.
-- The verify-stamp edge function (service role, RLS-bypassing) is the
-- only stamp writer; it verifies or confirms demo authorization first.

DROP POLICY IF EXISTS "stamps_own" ON public.stamps;

DROP POLICY IF EXISTS "stamps_select_own" ON public.stamps;
CREATE POLICY "stamps_select_own" ON public.stamps
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "stamps_update_own" ON public.stamps;
CREATE POLICY "stamps_update_own" ON public.stamps
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "stamps_delete_own" ON public.stamps;
CREATE POLICY "stamps_delete_own" ON public.stamps
  FOR DELETE USING (user_id = auth.uid());

-- ── 5. collector_passports.acquired_demo ────────────────────────────────────

ALTER TABLE public.collector_passports
  ADD COLUMN IF NOT EXISTS acquired_demo boolean NOT NULL DEFAULT false;

-- ── 6. ensure_collector_passport: server-side payment + identity gate ───────
-- Re-created per the established 021→025 pattern. Signature gains a
-- defaulted p_demo, so the old 2-arg form must be dropped (an added
-- default would otherwise create an ambiguous overload).

DROP FUNCTION IF EXISTS public.ensure_collector_passport(uuid, uuid);

CREATE OR REPLACE FUNCTION public.ensure_collector_passport(
  p_user_id     uuid,
  p_passport_id uuid,
  p_demo        boolean DEFAULT false
)
RETURNS TABLE(
  id          uuid,
  copy_number integer,
  expires_at  timestamptz,
  acquired_at timestamptz,
  is_new      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_existing       public.collector_passports%ROWTYPE;
  v_allocated      integer;
  v_duration       integer;
  v_expires_at     timestamptz;
  v_now            timestamptz := now();
  v_new            public.collector_passports%ROWTYPE;
  v_cred_type      text;
  v_target_count   integer;
  v_price_cents    integer;
  v_demo_acquire   boolean := false;
BEGIN
  -- Identity: a JWT caller may only acquire for themselves. auth.uid()
  -- IS NULL = service-role / direct SQL (seeding) — trusted.
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'callers may only acquire passports for themselves'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent fast-path: existing row.
  SELECT * INTO v_existing
    FROM public.collector_passports
   WHERE user_id = p_user_id
     AND passport_id = p_passport_id;

  IF FOUND THEN
    id          := v_existing.id;
    copy_number := v_existing.copy_number;
    expires_at  := v_existing.expires_at;
    acquired_at := v_existing.acquired_at;
    is_new      := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.expiry_duration_days, p.credential_type, p.consumable_target_count,
         COALESCE(p.price_cents, 0)
    INTO v_duration, v_cred_type, v_target_count, v_price_cents
    FROM public.passports p
   WHERE p.id = p_passport_id;

  -- Payment gate (server-side). Paid passports acquire here ONLY as an
  -- explicit, authorized demo acquisition; real purchases come through
  -- the payment rail, which writes via service role with p_demo false
  -- after charging. The demo intent must be explicit (p_demo) so an
  -- authorized user with demo mode OFF still can't acquire paid
  -- passports free by accident.
  IF v_price_cents > 0 THEN
    IF NOT p_demo THEN
      IF auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'payment required'
          USING ERRCODE = '42501';
      END IF;
      -- service-role path: legitimate post-payment grant, not demo.
    ELSE
      IF auth.uid() IS NOT NULL AND NOT public.is_demo_authorized() THEN
        RAISE EXCEPTION 'demo acquisition requires demo authorization'
          USING ERRCODE = '42501';
      END IF;
      v_demo_acquire := true;
    END IF;
  ELSIF p_demo THEN
    -- Free passport acquired while demo mode is on: still mark it, so
    -- a demo session leaves no unmarked rows.
    IF auth.uid() IS NOT NULL AND NOT public.is_demo_authorized() THEN
      RAISE EXCEPTION 'demo acquisition requires demo authorization'
        USING ERRCODE = '42501';
    END IF;
    v_demo_acquire := true;
  END IF;

  -- New acquisition path.
  v_allocated := public.allocate_copy_number(p_passport_id);

  IF v_duration IS NOT NULL THEN
    v_expires_at := v_now + make_interval(days => v_duration);
  ELSE
    v_expires_at := NULL;
  END IF;

  INSERT INTO public.collector_passports
    (user_id, passport_id, acquired_at, copy_number, expires_at, acquired_demo)
  VALUES
    (p_user_id, p_passport_id, v_now, v_allocated, v_expires_at, v_demo_acquire)
  RETURNING * INTO v_new;

  -- Consumable side-effect: seed the first card_instance. Refuses
  -- if the design doesn't carry a target count — that field is
  -- the M4 designer's commitment to a card length, not something
  -- we should silently default away.
  IF v_cred_type = 'consumable' THEN
    IF v_target_count IS NULL THEN
      RAISE EXCEPTION 'consumable passport missing consumable_target_count'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.card_instances
      (collector_passport_id, sequence, target_count, reissue_on_completion)
    VALUES
      (v_new.id, 1, v_target_count, true);
  END IF;

  id          := v_new.id;
  copy_number := v_new.copy_number;
  expires_at  := v_new.expires_at;
  acquired_at := v_new.acquired_at;
  is_new      := true;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_collector_passport(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_collector_passport(uuid, uuid, boolean) TO authenticated;
