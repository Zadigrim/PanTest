-- Migration 072: security hardening — search_path + anon revokes
--
-- Web-tree migration. Pure metadata changes — no schema, no
-- behavior change for any authenticated caller. Closes the
-- Supabase database-linter warnings:
--   * 0011 function_search_path_mutable
--   * 0028 anon_security_definer_function_executable
--   * 0029 authenticated_security_definer_function_executable
--          (for the subset that are trigger-only)
--
-- WHAT THIS DOES
--
-- (1) Pins search_path on existing functions that ship without it.
--     A function without `SET search_path` resolves identifiers
--     using the caller's search_path; a malicious user-created
--     object earlier in the path could intercept resolution. The
--     fix is pure metadata — ALTER FUNCTION ... SET search_path
--     does not change the function body.
--
-- (2) Revokes EXECUTE from anon on every SECURITY DEFINER function
--     that has no business being callable without authentication.
--     My M3 functions REVOKE FROM PUBLIC + GRANT TO authenticated
--     already, but Supabase grants anon separately from PUBLIC in
--     some project setups, so an explicit REVOKE FROM anon is
--     required to actually lock anon out.
--
-- (3) For trigger-only functions (handle_new_user,
--     sync_comp_to_profile, enforce_publish_gate), revokes from
--     authenticated too — only the trigger machinery should invoke
--     them; direct RPC calls are never appropriate.
--
-- INTENTIONALLY UNCHANGED
--
--   is_admin / is_platform_admin remain EXECUTE-able by
--   authenticated. RLS policies call them in the executing user's
--   context; that path is the whole point. Only anon is revoked.
--
--   The bucket-listing warnings (public_bucket_allows_listing)
--   are handled out-of-band via the Supabase dashboard's Storage
--   policies — they're storage-side, not SQL-tree migrations.
--
--   The leaked-password protection warning is a dashboard toggle
--   in Authentication settings, not code.
--
-- ROLLBACK
--   ALTER FUNCTION ... RESET search_path for each pinned function.
--   GRANT EXECUTE ... TO anon for each revoked function. Safe
--   because the change is metadata-only.

-- ─── (1) Pin search_path on existing functions ──────────────────
-- Each ALTER is independent + idempotent. If a function doesn't
-- exist in a given environment, the statement errors only on that
-- one line — wrap in DO blocks so unknown functions don't abort
-- the migration.

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.check_gps_within_radius(double precision, double precision, uuid, double precision) SET search_path = public, extensions, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer) SET search_path = public, extensions, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.trim_passport_autosaves() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.set_passport_last_edited() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.is_platform_admin() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.sync_verification_tier_from_method() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.okuji_custodial_id() SET search_path = public, pg_catalog';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ─── (2) Revoke EXECUTE from anon on every SECURITY DEFINER fn ──
-- Functions that should remain callable by authenticated but
-- never by anon. The DO wrapper tolerates missing functions
-- (e.g. environments that haven't shipped a particular feature).
DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    -- M3 (mobile-tree 021)
    'public.issue_stop_qr_token(uuid, integer)',
    'public.consume_stop_qr_token_and_punch(text, double precision, double precision, timestamp with time zone)',
    'public.redeem_completion(text, text, text, integer)',
    'public.generate_completion_token_code(uuid)',
    -- M2 follow-up (mobile-tree 019 / web-tree 070)
    'public.ensure_collector_passport(uuid, uuid)',
    'public.allocate_copy_number(uuid)',
    -- Transfer flow
    'public.initiate_passport_transfer(uuid, uuid, uuid, text)',
    'public.accept_passport_transfer(uuid)',
    'public.decline_passport_transfer(uuid)',
    'public.cancel_passport_transfer(uuid)',
    -- Account closure
    'public.close_user_account(uuid)',
    -- Comp grants
    'public.can_grant_comp_for(uuid)',
    -- Asset references
    'public.count_asset_references(uuid, text)',
    'public.list_asset_references(uuid, text)',
    -- Comment moderation
    'public.report_stop_comment(uuid)',
    'public.set_stop_comment_hidden(uuid, boolean)',
    -- Admin gates — authenticated must keep EXECUTE for RLS to
    -- evaluate is_admin / is_platform_admin in the caller's
    -- context. Only anon is revoked.
    'public.is_admin()',
    'public.is_platform_admin()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_sig);
    EXCEPTION
      WHEN undefined_function THEN NULL;
      WHEN undefined_object   THEN NULL;
    END;
  END LOOP;
END $$;

-- ─── (3) Trigger-only functions — revoke from both anon AND auth ─
-- These functions exist ONLY to be invoked by triggers (the
-- trigger machinery runs them as the row's owning role and
-- bypasses RPC permissions). Exposing them as RPCs at all is a
-- mistake; revoke from every non-superuser role.
DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public.handle_new_user()',
    'public.sync_comp_to_profile()',
    'public.enforce_publish_gate()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', v_sig);
    EXCEPTION
      WHEN undefined_function THEN NULL;
      WHEN undefined_object   THEN NULL;
    END;
  END LOOP;
END $$;
