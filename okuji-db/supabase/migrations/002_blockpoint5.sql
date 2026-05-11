-- Migration 002: Blockpoint 5 — fix RLS recursion, create is_platform_admin()

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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_platform_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Fix self-referential recursion in emp_auth_read
DROP POLICY IF EXISTS "emp_auth_read" ON public.employee_authorizations;
CREATE POLICY "emp_auth_read" ON public.employee_authorizations
  FOR SELECT USING (
    public.is_platform_admin() = true
    OR user_id = auth.uid()
    OR authorized_by = auth.uid()
  );
