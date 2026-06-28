-- 105: lock passports.is_demo to platform admins + reconcile its semantics.
--
-- RECONCILE migration 039 (BLD-32). 039 added passports.is_demo as an
-- ADMIN-ONLY, CLIENT-SIDE viewing bypass: a platform admin viewing a demo
-- passport skipped GPS / acquisition / stop ordering in the mobile UI, while
-- non-admins were unchanged. Under those semantics the column was deliberately
-- left WRITABLE by the passport creator (the passports write gate is
-- creator_id = auth.uid() OR is_admin() OR can_design, migration 038), because
-- a creator toggling it only affected what ADMINS saw.
--
-- The demo-publishing feature CHANGES the meaning of is_demo: a demo passport
-- now lets ANY holder stamp regardless of GPS — the verify-stamp edge function
-- reads is_demo server-side and allows-but-records the stamp. Under that
-- meaning, a creator self-setting is_demo on their own passport would let
-- anyone stamp it from anywhere, destroying verification integrity. So is_demo
-- must become settable ONLY by a platform admin (demo-PUBLISH is admin-only;
-- demo-STAMP is any holder — the two permissions are separate by design).
--
-- This adds the same column guard used for profiles.demo_mode_enabled (mig 026)
-- and profiles.is_platform_admin (mig 103): a BEFORE INSERT OR UPDATE trigger
-- rejecting any non-admin change to is_demo. Trusted paths preserved —
-- service role / direct SQL (auth.uid() IS NULL) and existing platform admins
-- are unrestricted (that is the demo-publish path). Normal publish/create never
-- sets is_demo (default false), so they are unaffected.
--
-- ROLLBACK: drop the trigger + function.

CREATE OR REPLACE FUNCTION public.guard_passports_is_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_demo, false) = true
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passports.is_demo may only be set by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_demo IS DISTINCT FROM OLD.is_demo
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passports.is_demo may only be changed by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_passports_is_demo ON public.passports;
CREATE TRIGGER trg_guard_passports_is_demo
  BEFORE INSERT OR UPDATE ON public.passports
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_passports_is_demo();
