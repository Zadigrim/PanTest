-- BLD-10: Public-marketplace publish gate (server-side enforcement).
--
-- Until now any creator could flip passports.is_published = true on a
-- passport they owned, regardless of subscription tier. Per Appendix L
-- the public marketplace is a Studio-tier (or institutional) capability:
-- a free / non-Studio user can build and save private passports but
-- cannot push a personal passport to the public marketplace.
--
-- This trigger enforces that at the DB layer so the rule holds against
-- the supabase client, an API route, or any direct write. The existing
-- passport_creator RLS policy (migration 038) still gates WHO can
-- update a passport row at all (creator / can_design employee / admin);
-- this trigger adds a transition check on TOP of that policy for the
-- single field is_published when it goes false → true.
--
-- Personal vs institutional:
--   - proprietor_id IS NULL  → personal passport. Publishing requires
--                              an active, non-expired Studio
--                              subscription on the actor's profile.
--   - proprietor_id IS NOT NULL → institutional passport. Publishing
--                              requires can_design on the proprietor
--                              for the actor. (Same condition the
--                              RLS policy already permits for UPDATE
--                              of the row.)
--   - platform admin always allowed.
--
-- Draft saving, edit, delete, unpublish, etc. are NOT affected — only
-- the specific transition is_published false → true is gated.
--
-- The error messages are user-facing (PublishFlow surfaces err.message
-- directly); keep them clear about which tier is required so a comp
-- can fix it.

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
  -- Only enforce on the false → true transition (or INSERT with
  -- is_published = true). All other updates pass through.
  IF NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();

  -- Platform admin bypass (mirrors RLS).
  SELECT public.is_platform_admin() INTO v_admin;
  IF v_admin IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.proprietor_id IS NOT NULL THEN
    -- Institutional passport: existing rule — actor must be an
    -- employee with can_design at the proprietor institution.
    SELECT EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = v_actor
         AND ea.institution_id = NEW.proprietor_id
         AND ea.can_design = TRUE
    ) INTO v_can_design;
    IF v_can_design IS TRUE THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Publishing this passport requires "can_design" at the owning institution.'
      USING ERRCODE = '42501';
  END IF;

  -- Personal passport: actor must hold an active, non-expired Studio
  -- subscription. Source ('paid' or 'comp') is not differentiated —
  -- the comp grant trigger sets status='active' and that's enough.
  SELECT (
    p.studio_status = 'active'
    AND (p.studio_expires_at IS NULL OR p.studio_expires_at > now())
  )
    INTO v_studio_active
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_studio_active IS TRUE THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Publishing a personal passport to the marketplace requires Studio. Ask an admin for a Studio comp at /access/comp-subscriptions, or upgrade when Studio billing is live.'
    USING ERRCODE = '42501';
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_publish_gate() TO authenticated;

DROP TRIGGER IF EXISTS passports_enforce_publish_gate ON public.passports;
CREATE TRIGGER passports_enforce_publish_gate
  BEFORE INSERT OR UPDATE OF is_published ON public.passports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_publish_gate();
