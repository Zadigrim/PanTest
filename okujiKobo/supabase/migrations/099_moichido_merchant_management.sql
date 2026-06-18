-- Migration 099: moichido merchant-management fields + merchant comp.
--
-- Console need: per-merchant card limit, subscription tier, recorded monthly
-- amount, active/suspended state, and comp status. Per the ruling:
--   • Operational merchant config lives on institutions (NOT a parallel
--     subscription system — just management metadata).
--   • Comp status flows through comp_subscriptions (the ONE comp mechanism),
--     extended to be institution-scoped, with the 036 trigger gated so a
--     merchant comp NEVER flips someone's okuji Pro/Studio.
-- Billing is deferred: recorded_amount is a managed value, not a charge.
--
-- Web tree only (institutions + comp_subscriptions are web-tree tables; moichido
-- cards are web-side passports). No mobile-tree change, no cross-tree ordering.
--
-- ROLLBACK: drop the added columns + re-tighten comp_subscriptions; restore the
-- 036 trigger body. Additive; modifies no existing row.

-- ── Merchant management config on institutions ───────────────────────────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moichido_card_limit integer,
  ADD COLUMN IF NOT EXISTS moichido_tier text,
  ADD COLUMN IF NOT EXISTS moichido_recorded_amount_cents integer;

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_status_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_status_check
  CHECK (status IN ('active', 'suspended'));

-- ── comp_subscriptions: allow institution-scoped (merchant) comps ────────────
ALTER TABLE public.comp_subscriptions
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.comp_subscriptions
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE;

-- Widen the tier CHECK to include the merchant comp marker 'moichido'.
ALTER TABLE public.comp_subscriptions
  DROP CONSTRAINT IF EXISTS comp_subscriptions_tier_check;
ALTER TABLE public.comp_subscriptions
  ADD CONSTRAINT comp_subscriptions_tier_check
  CHECK (tier IN ('pro', 'studio', 'moichido'));

-- Exactly one scope: a user comp (okuji Pro/Studio) XOR an institution comp
-- (moichido merchant). num_nonnulls = 1.
ALTER TABLE public.comp_subscriptions
  DROP CONSTRAINT IF EXISTS comp_subscriptions_scope_check;
ALTER TABLE public.comp_subscriptions
  ADD CONSTRAINT comp_subscriptions_scope_check
  CHECK (num_nonnulls(user_id, institution_id) = 1);

-- At most one ACTIVE merchant comp per institution (mirrors the per-user one).
CREATE UNIQUE INDEX IF NOT EXISTS comp_subscriptions_active_institution_unique
  ON public.comp_subscriptions (institution_id)
  WHERE institution_id IS NOT NULL AND revoked_at IS NULL;

-- ── Gate the 036 trigger to ignore institution-scoped (merchant) comps ───────
-- A merchant comp must never touch profiles.{pro,studio}_*. (tier='moichido'
-- already falls through the IF/ELSIF below, but the explicit guard is the
-- contract.)
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
  -- Institution-scoped (merchant) comp: not a per-user okuji entitlement.
  IF COALESCE(NEW.institution_id, OLD.institution_id) IS NOT NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_user := COALESCE(NEW.user_id, OLD.user_id);
  target_tier := COALESCE(NEW.tier, OLD.tier);

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
