-- Account closure with custodial transfer of acquired passports.
--
-- Triggered manually for v1: an admin (or eventually a user-facing
-- "Delete Account" button) calls `SELECT close_user_account('<uuid>')`.
-- Everything happens in a single transaction; either the closure
-- finishes cleanly or rolls back leaving the user untouched.
--
-- Policy (specified by Nathan):
--   • Drafts (no acquisitions, any status): deleted.
--   • Published but never acquired: deleted.
--   • Acquired by anyone (≥1 row in acquisitions OR collector_passports):
--     reassigned to the Okuji Custodial account, set is_published=false
--     and status='custodial' so it's delisted from Explore (existing
--     holders keep their copies via collector_passports/acquisitions —
--     RLS permits "I've acquired it" regardless of is_published).
--   • Institutional (proprietor_id set): leave content/state alone, but
--     reassign creator_id to custodial so the FK is satisfied after the
--     user's profile is deleted. The institution still owns it.
--
-- Collector-side data (their acquisitions, stamps, journals, moods,
-- check-ins, sent tips): deleted with the account, per Nathan's
-- privacy choice.

-- ── Step 1. Custodial account ────────────────────────────────────────────────
--
-- A non-personal profile that owns kept-but-frozen passports of closed
-- accounts. profiles.id is FK to auth.users.id (ON DELETE CASCADE) so
-- we need a matching auth.users row even though no one logs in as
-- this account. Use a fixed UUID so closure code can reference it as
-- a constant.

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  email_confirmed_at,
  is_super_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'custodial@okuji.system',
  '{"provider": "system", "providers": ["system"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  now(),
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id,
  display_name,
  role,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Okuji Custodial',
  'admin',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Constant accessor. IMMUTABLE so it inlines in query plans.
CREATE OR REPLACE FUNCTION public.okuji_custodial_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;

-- ── Step 2. Loosen NOT NULL on audit-attribution columns that closure
--     needs to clear. These are write-once audit pointers and the
--     application has not relied on their NOT NULL constraint to
--     mean anything beyond "originally recorded". After this migration
--     they may be NULL when the original actor's account has closed.

ALTER TABLE public.print_jobs
  ALTER COLUMN created_by DROP NOT NULL;

-- (Other audit fields — comp_subscriptions.granted_by,
--  employee_authorizations.authorized_by, completion_tokens.redeemed_by,
--  completion_tokens.distribution_logged_by, prize_configurations.configured_by,
--  passports.last_edited_by — are already nullable.)

-- ── Step 3. The closure function ─────────────────────────────────────────────
--
-- SECURITY DEFINER so it bypasses RLS while running. The caller must
-- be authenticated AND either be closing their own account (auth.uid()
-- = target) or hold platform-admin. We re-check inside the function
-- so a stray callsite can't escalate.

CREATE OR REPLACE FUNCTION public.close_user_account(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  custodial_id           uuid := public.okuji_custodial_id();
  caller_id              uuid := auth.uid();
  caller_is_admin        boolean;
  acquired_count         integer;
  unacquired_count       integer;
  institutional_count    integer;
  custodial_locked_count integer;
BEGIN
  -- ── Authorisation ─────────────────────────────────────────────────────────
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is null';
  END IF;
  IF target_user_id = custodial_id THEN
    RAISE EXCEPTION 'cannot close the custodial account';
  END IF;

  SELECT COALESCE(is_platform_admin, false) INTO caller_is_admin
    FROM public.profiles WHERE id = caller_id;

  IF caller_id IS NULL THEN
    -- Invoked via service-role (no JWT). Permit — used by admin tooling.
    NULL;
  ELSIF caller_id <> target_user_id AND NOT caller_is_admin THEN
    RAISE EXCEPTION 'caller % not authorised to close account %', caller_id, target_user_id;
  END IF;

  -- ── 1. Null audit-attribution fields (nullable) ──────────────────────────
  UPDATE public.comp_subscriptions       SET granted_by              = NULL WHERE granted_by = target_user_id;
  UPDATE public.employee_authorizations  SET authorized_by           = NULL WHERE authorized_by = target_user_id;
  UPDATE public.completion_tokens        SET redeemed_by             = NULL WHERE redeemed_by = target_user_id;
  UPDATE public.completion_tokens        SET distribution_logged_by  = NULL WHERE distribution_logged_by = target_user_id;
  UPDATE public.passports                SET last_edited_by          = NULL WHERE last_edited_by = target_user_id;

  -- prize_configurations.configured_by (if it exists in this DB):
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prize_configurations' AND column_name = 'configured_by'
  ) THEN
    EXECUTE 'UPDATE public.prize_configurations SET configured_by = NULL WHERE configured_by = $1' USING target_user_id;
  END IF;

  -- ── 2. Reassign NOT-NULL audit + creator fields to custodial ─────────────
  -- These tables must outlive the user (other parties' records depend
  -- on them), so they get reassigned rather than deleted.
  UPDATE public.print_jobs    SET created_by = NULL          WHERE created_by = target_user_id;
  UPDATE public.tips          SET creator_id = custodial_id  WHERE creator_id = target_user_id;

  -- journeys / journey_members are optional features — guard.
  IF to_regclass('public.journeys') IS NOT NULL THEN
    EXECUTE 'UPDATE public.journeys SET created_by = $1 WHERE created_by = $2'
      USING custodial_id, target_user_id;
  END IF;

  -- design_assets the user uploaded — keep alive (other passports may
  -- reference them) by transferring ownership.
  UPDATE public.design_assets SET owner_id   = custodial_id WHERE owner_id   = target_user_id;

  -- ── 3. Delete user-owned personal data (per Nathan's privacy choice) ─────
  --
  -- Order matters: stamps reference collector_passports; journal_entries
  -- reference stops which we don't touch; tips with from_user_id are
  -- the user's gifts and go with them.

  DELETE FROM public.tips                 WHERE from_user_id = target_user_id;
  DELETE FROM public.journal_sharing_terms WHERE from_user_id = target_user_id OR to_user_id = target_user_id;

  IF to_regclass('public.journey_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.journey_members WHERE user_id = $1' USING target_user_id;
  END IF;

  IF to_regclass('public.mood_ratings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.mood_ratings WHERE user_id = $1' USING target_user_id;
  END IF;

  DELETE FROM public.journal_entries    WHERE user_id = target_user_id;
  DELETE FROM public.presence_sessions  WHERE user_id = target_user_id;
  DELETE FROM public.stamps             WHERE user_id = target_user_id;
  DELETE FROM public.completion_tokens  WHERE user_id = target_user_id;
  DELETE FROM public.acquisitions       WHERE user_id = target_user_id;
  DELETE FROM public.collector_passports WHERE user_id = target_user_id;
  DELETE FROM public.employee_authorizations WHERE user_id = target_user_id;

  -- comp_subscriptions FK is ON DELETE CASCADE (mig 036) — will go
  -- automatically when the profile is deleted. Left here as a no-op
  -- documentation hook.

  -- ── 4. Passports the user created ────────────────────────────────────────
  --
  -- Classification, in order:
  --   • Institutional (proprietor_id NOT NULL) — content untouched;
  --     creator_id reassigned to custodial so FK is satisfied.
  --   • Personal + acquired (≥1 collector_passports OR acquisitions
  --     for the passport across ALL collectors) — reassign creator_id
  --     to custodial AND set is_published=false AND status='custodial'.
  --     Existing holders see it via the collector-acquired RLS branch;
  --     no new acquisitions possible.
  --   • Personal + unacquired — delete (cascades pages + stops).

  UPDATE public.passports
     SET creator_id = custodial_id
   WHERE creator_id = target_user_id
     AND proprietor_id IS NOT NULL;
  GET DIAGNOSTICS institutional_count = ROW_COUNT;

  -- Mark acquired personal passports custodial. The EXISTS check spans
  -- both acquisition surfaces (acquisitions + collector_passports).
  WITH locked AS (
    UPDATE public.passports p
       SET creator_id   = custodial_id,
           is_published = false,
           status       = 'custodial'
     WHERE p.creator_id   = target_user_id
       AND p.proprietor_id IS NULL
       AND (
         EXISTS (SELECT 1 FROM public.acquisitions       a WHERE a.passport_id = p.id)
         OR EXISTS (SELECT 1 FROM public.collector_passports cp WHERE cp.passport_id = p.id)
       )
     RETURNING p.id
  )
  SELECT COUNT(*) INTO custodial_locked_count FROM locked;

  -- Remaining personal passports = unacquired; delete (cascades pages/stops).
  DELETE FROM public.passports p
   WHERE p.creator_id = target_user_id
     AND p.proprietor_id IS NULL;
  GET DIAGNOSTICS unacquired_count = ROW_COUNT;

  -- Sanity: no acquired passport should remain pointing at the user.
  SELECT COUNT(*) INTO acquired_count
    FROM public.passports
   WHERE creator_id = target_user_id;
  IF acquired_count > 0 THEN
    RAISE EXCEPTION 'closure invariant violated: % passports still owned by target after reassignment', acquired_count;
  END IF;

  -- ── 5. Delete the profile + auth.users row ───────────────────────────────
  -- profile cascades from auth.users via ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'closed_user_id',          target_user_id,
    'custodial_id',            custodial_id,
    'unacquired_deleted',      unacquired_count,
    'institutional_reassigned',institutional_count,
    'acquired_to_custodial',   custodial_locked_count
  );
END;
$$;

-- Lock down execution. Service-role bypasses; an authenticated user
-- closing themselves goes through the function's internal auth check.
REVOKE ALL ON FUNCTION public.close_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_user_account(uuid) TO authenticated;

-- ── Step 4. status='custodial' as a passport status value ────────────────────
-- No CHECK constraint exists on passports.status today (it's an open
-- text field), so the UPDATE above succeeds without schema change. If
-- a CHECK gets added later, include 'custodial' in the list. Left as
-- documentation; no DDL needed here.

-- Verification (manual):
--   BEGIN;
--   SELECT public.close_user_account('<test-user-uuid>');
--   -- inspect resulting counts
--   ROLLBACK;
-- Wrap the call in a tx and ROLLBACK to dry-run on a live DB.
