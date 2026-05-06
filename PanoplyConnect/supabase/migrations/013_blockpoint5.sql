-- Migration 013: Blockpoint 5 — fix RLS recursion, create is_platform_admin()
-- Run after 012.

-- ── Create is_platform_admin() as a canonical SECURITY DEFINER function ───────
-- The existing is_admin() alias is kept for backward compatibility.
-- Running as the function owner (postgres) means the SELECT on profiles
-- bypasses RLS, breaking the potential recursion chain.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Keep is_admin() as an alias so existing policies continue to work.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_platform_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── Fix infinite recursion in emp_auth_read policy ────────────────────────────
-- The previous policy contained:
--   OR EXISTS (SELECT 1 FROM public.employee_authorizations ea WHERE ...)
-- That self-referential subquery causes infinite recursion because Postgres
-- re-evaluates the policy when it enters the EXISTS subquery.
-- New policy: read your own row OR admin sees all — no self-reference.
DROP POLICY IF EXISTS "emp_auth_read" ON public.employee_authorizations;
CREATE POLICY "emp_auth_read" ON public.employee_authorizations
  FOR SELECT USING (
    public.is_platform_admin() = true
    OR user_id = auth.uid()
    OR authorized_by = auth.uid()
  );
