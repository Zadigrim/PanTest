-- 031: stamps.gps_verified — honest record of the real proximity result.
--
-- Demo-published passports (passports.is_demo) let any holder stamp regardless
-- of location. The verify-stamp edge function still runs the GPS/QR check on
-- those stamps and records the ACTUAL outcome here, so demo stamps never
-- masquerade as verified (verification_method stays 'demo', is_demo stays true,
-- per migration 026) yet the real "was the holder actually on-site?" signal is
-- preserved for honest analytics.
--
-- Nullable tri-state:
--   true  — GPS fix was within the stop's radius
--   false — GPS fix was outside the radius (a demo stamp placed off-site)
--   null  — no proximity check applicable (honor tier, or no GPS fix provided)
--
-- Set for NON-demo stamps too (true on a passed GPS tier), so the column is a
-- uniform record across all stamps. Additive; the existing mobile client does
-- not read it (freeze-safe — no new binary required to consume it).
--
-- ROLLBACK: ALTER TABLE public.stamps DROP COLUMN gps_verified.

ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS gps_verified boolean;
