-- Phase 2, /access master/detail rewrite — wire the previously-
-- disabled controls.
--
-- THIS MIGRATION SHIPS THREE CHANGES:
--
-- 1. Helper public.can_grant_comp_for(uuid)
--    Returns true when the caller is allowed to grant or revoke a
--    comp subscription on behalf of the target user. Admin always
--    passes. A non-admin passes when the target user has an
--    employee_authorizations row in some institution the caller
--    manages — either as the institution's direct owner
--    (institutions.id = auth.uid()) or with can_manage_employees =
--    true in employee_authorizations for that institution.
--    SECURITY DEFINER so the helper can read employee_authorizations
--    + institutions without recursing through their RLS policies.
--
-- 2. comp_subscriptions RLS — add the "manager" policy alongside
--    the existing admin policy. Existing admin policy stays in
--    place untouched (defense in depth — two policies are OR'd by
--    Postgres, so admin paths keep working even if the helper has
--    a bug).
--
--    Manager policy WITH CHECK clamps writes to (granted_by =
--    auth.uid()) so the audit row reflects who actually granted it.
--    Managers can't impersonate another granter.
--
-- 3. /api/analytics route enforcement of can_view_analytics, and
--    /api/institutions PATCH enforcement of can_manage_billing for
--    the billing-sensitive fields. Both happen in application code
--    (the companion route changes in this PR); this migration is
--    the RLS/SQL half only.
--
-- ROLLBACK
--   To revert: DROP POLICY "comp_subscriptions_manager" ON
--   public.comp_subscriptions; DROP FUNCTION
--   public.can_grant_comp_for(uuid). Admin-only RLS is restored.

-- ── Helper ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_grant_comp_for(p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller uuid := auth.uid();
  result boolean := false;
BEGIN
  IF caller IS NULL THEN
    RETURN false;
  END IF;

  -- Admin: always.
  IF public.is_platform_admin() = true THEN
    RETURN true;
  END IF;

  -- The target must be an employee of some institution where the
  -- caller is also a manager (direct owner OR can_manage_employees).
  SELECT EXISTS (
    SELECT 1
      FROM public.employee_authorizations target_emp
      JOIN public.institutions inst
        ON inst.id = target_emp.institution_id
     WHERE target_emp.user_id = p_target
       AND (
            -- Direct owner.
            inst.id = caller
         OR EXISTS (
              SELECT 1
                FROM public.employee_authorizations manager_emp
               WHERE manager_emp.institution_id = inst.id
                 AND manager_emp.user_id = caller
                 AND manager_emp.can_manage_employees = true
            )
       )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.can_grant_comp_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_grant_comp_for(uuid) TO authenticated;

-- ── Policy ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "comp_subscriptions_manager" ON public.comp_subscriptions;
CREATE POLICY "comp_subscriptions_manager" ON public.comp_subscriptions
  FOR ALL
  USING (public.can_grant_comp_for(user_id) = true)
  WITH CHECK (
    public.can_grant_comp_for(user_id) = true
    AND granted_by = auth.uid()
  );

-- Existing comp_subscriptions_admin policy from migration 036 is
-- intentionally left in place. Policies are OR'd; admins keep
-- their FOR ALL grant either way.
