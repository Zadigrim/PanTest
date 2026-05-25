-- ─────────────────────────────────────────────
-- 004 — last_used_at on collector_passports
-- Drives "recently used first" ordering on the mobile My Passports list.
-- "Used" = a stamp was recorded against this collector passport.
-- ─────────────────────────────────────────────
ALTER TABLE public.collector_passports
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Backfill from existing stamps: most recent stamp per collector passport.
UPDATE public.collector_passports cp
SET last_used_at = s.max_verified
FROM (
  SELECT collector_passport_id, MAX(verified_at) AS max_verified
  FROM public.stamps
  GROUP BY collector_passport_id
) s
WHERE s.collector_passport_id = cp.id;

-- Keep it current: every new stamp bumps its collector passport.
CREATE OR REPLACE FUNCTION public.touch_collector_passport_last_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.collector_passports
  SET last_used_at = NEW.verified_at
  WHERE id = NEW.collector_passport_id
    AND (last_used_at IS NULL OR NEW.verified_at > last_used_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamps_touch_last_used ON public.stamps;
CREATE TRIGGER stamps_touch_last_used
  AFTER INSERT ON public.stamps
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_collector_passport_last_used();
