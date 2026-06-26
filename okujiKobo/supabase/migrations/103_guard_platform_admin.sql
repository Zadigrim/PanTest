-- Migration 103: guard profiles.is_platform_admin against client self-promotion.
--
-- SECURITY (CRITICAL — pre-tester audit finding C1). The profiles_own RLS policy
-- is `FOR ALL USING (auth.uid() = id)` with NO WITH CHECK and no column-level
-- restriction, and the `authenticated` role holds table UPDATE — so the row
-- owner can UPDATE ANY column of their own row, including is_platform_admin.
-- Because is_platform_admin() (the single admin gate) trusts this column and the
-- journal/admin RLS policies branch on `OR is_admin()`, an attacker could run
--
--   UPDATE public.profiles SET is_platform_admin = true WHERE id = auth.uid();
--
-- to self-promote to platform admin and then read EVERY collector's private
-- journal (plus reach every admin route: PII/keepsake export, comp grants,
-- force-purge, retention deletes). Nothing else stops it.
--
-- This mirrors the existing guard_profiles_demo_mode trigger (mobile migration
-- 026), which already protects the demo_mode_enabled column exactly this way —
-- the privileged admin flag simply never got the equivalent guard.
--
-- Trusted paths are preserved:
--   - auth.uid() IS NULL covers service-role writes and direct admin SQL — this
--     is how the FIRST admin is bootstrapped:
--       UPDATE public.profiles SET is_platform_admin = true WHERE id = '<uuid>';
--     run from the SQL editor / service role.
--   - an EXISTING platform admin may still set the flag for anyone.
--   - normal signup is unaffected: handle_new_user inserts the default (false),
--     so the guard's "is the flag actually being raised" check short-circuits.
--
-- ROLLBACK: drop the trigger + function.

CREATE OR REPLACE FUNCTION public.guard_profiles_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only police an actual elevation of the privileged flag; demotions and
  -- all other column edits pass untouched.
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_platform_admin, false) = true
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'is_platform_admin may only be set by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'is_platform_admin may only be changed by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_platform_admin ON public.profiles;
CREATE TRIGGER trg_guard_profiles_platform_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_platform_admin();
