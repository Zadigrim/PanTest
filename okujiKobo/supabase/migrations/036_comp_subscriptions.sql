-- Phase 1, BLD-12: comp_subscriptions — Nathan grants Pro / Studio
-- access to ambassadors without payment integration.
--
-- comp_subscriptions is the canonical record of comp grants.
-- profiles.{pro,studio}_{status,source,expires_at} is derived from it
-- via the sync_comp_to_profile trigger below. This separation lets
-- Phase 4 (paid billing) be added without changing this table: paid
-- subscriptions will write to a separate paid_subscriptions table; the
-- trigger consolidates both sources into the profiles status columns.
--
-- RLS: admin-only. Users do not see their own comp records directly;
-- they only see their derived status via profiles columns. Limiting
-- the surface area also limits the social-pressure surface ("why does
-- this user have a comp and I don't?").

CREATE TABLE IF NOT EXISTS public.comp_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier         text        NOT NULL CHECK (tier IN ('pro', 'studio')),
  granted_by   uuid        NOT NULL REFERENCES public.profiles(id),
  granted_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,  -- null = no expiration
  revoked_at   timestamptz,  -- non-null = revoked
  note         text
);

-- At most one ACTIVE comp per (user, tier). Revoked rows are kept for
-- audit trail; another grant for the same user/tier is permitted as
-- long as no prior grant is currently active.
CREATE UNIQUE INDEX IF NOT EXISTS comp_subscriptions_active_unique
  ON public.comp_subscriptions (user_id, tier)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS comp_subscriptions_user_idx
  ON public.comp_subscriptions (user_id);

ALTER TABLE public.comp_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_subscriptions_admin" ON public.comp_subscriptions;
CREATE POLICY "comp_subscriptions_admin" ON public.comp_subscriptions
  FOR ALL USING (public.is_platform_admin() = true);

-- ─────────────────────────────────────────────────────────────────────
-- sync_comp_to_profile — keeps profiles.{pro,studio}_{status,source,expires_at}
-- in sync with comp_subscriptions.
--
-- Trigger semantics:
--   - On INSERT, UPDATE, or DELETE of any comp_subscriptions row,
--     recompute the affected user's status for the affected tier.
--   - A user with an active (non-revoked, non-expired) comp for tier T
--     has profiles.<T>_status = 'active', source = 'comp', expires_at
--     copied from the comp.
--   - A user with no active comp for tier T (no matching row, or
--     revoked, or expired) has profiles.<T>_status = 'none' and source
--     and expires_at NULL. This currently overrides any paid status,
--     because Phase 1 has no paid path. Phase 4 (BLD-25..27) will
--     extend this trigger to consider paid + comp sources together
--     instead of treating comp as authoritative.
--   - SECURITY DEFINER so the trigger can update profiles even when
--     fired from a non-admin context (defense in depth — the comp
--     table itself is admin-only via RLS, so this is moot today, but
--     future paid flows may invoke updates without admin context).

CREATE OR REPLACE FUNCTION public.sync_comp_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
  target_tier text;
  active_expires timestamptz;
  has_active boolean;
BEGIN
  target_user := COALESCE(NEW.user_id, OLD.user_id);
  target_tier := COALESCE(NEW.tier, OLD.tier);

  -- Find the currently-active comp for this user + tier, if any.
  SELECT cs.expires_at INTO active_expires
    FROM public.comp_subscriptions cs
   WHERE cs.user_id = target_user
     AND cs.tier = target_tier
     AND cs.revoked_at IS NULL
     AND (cs.expires_at IS NULL OR cs.expires_at > now())
   LIMIT 1;

  has_active := FOUND;

  IF target_tier = 'pro' THEN
    UPDATE public.profiles SET
      pro_status     = CASE WHEN has_active THEN 'active' ELSE 'none' END,
      pro_source     = CASE WHEN has_active THEN 'comp'   ELSE NULL   END,
      pro_expires_at = CASE WHEN has_active THEN active_expires ELSE NULL END
     WHERE id = target_user;
  ELSIF target_tier = 'studio' THEN
    UPDATE public.profiles SET
      studio_status     = CASE WHEN has_active THEN 'active' ELSE 'none' END,
      studio_source     = CASE WHEN has_active THEN 'comp'   ELSE NULL   END,
      studio_expires_at = CASE WHEN has_active THEN active_expires ELSE NULL END
     WHERE id = target_user;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS comp_subscriptions_sync_profile ON public.comp_subscriptions;
CREATE TRIGGER comp_subscriptions_sync_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.comp_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_comp_to_profile();
