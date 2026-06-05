-- Migration 066: acquisitions.last_correction_dismissed_at
--                 + collector_passports.last_correction_dismissed_at
--
-- Per-holder dismissal of the correction-notice banner that
-- appears after a republish. NULL = the holder hasn't
-- dismissed since the most recent republish; non-NULL =
-- dismissed at this timestamp.
--
-- Banner-visibility rule (computed client-side):
--   show banner IFF
--     latest passport_republish_log.republished_at >
--     last_correction_dismissed_at
--   (treating NULL as "before any republish").
--
-- Two tables touched because the holder's "I've acquired
-- this passport" record lives in EITHER:
--   * acquisitions          — Connect (web) flow
--   * collector_passports   — Expo (mobile) flow
-- Both populated by the same /api/acquire + /api/checkout
-- paths. The web /library reads from acquisitions; the
-- mobile useCollectorPassports reads from collector_passports.
-- A holder dismisses on one device; both surfaces clear when
-- the dismiss endpoint writes to both tables (the rows are
-- joined by (user_id, passport_id)).
--
-- ROLLBACK: DROP COLUMN. Banner becomes "shows once per
-- session and is forgotten" — harmless degradation.

ALTER TABLE public.acquisitions
  ADD COLUMN IF NOT EXISTS last_correction_dismissed_at timestamptz NULL;

ALTER TABLE public.collector_passports
  ADD COLUMN IF NOT EXISTS last_correction_dismissed_at timestamptz NULL;
