-- Per-stop expected spend tier.
--
-- The passport-level `passports.expected_spend_tier` covers the whole
-- trip; this per-stop column lets the designer (and the future
-- verify-spend AI) reason about individual costs and sum-of-stops
-- comparisons. Nullable so existing stops keep working — null reads as
-- "unspecified" and the UI falls back to the passport-level estimate.
--
-- Values mirror the passport-level SpendTier vocabulary used in the
-- designer (lib/design/spend-tiers.ts) so the per-stop and per-passport
-- fields share a single set of buckets:
--
--   free       — no cost
--   under_5    — under $5 per visitor
--   5_to_15    — $5–$15
--   15_to_50   — $15–$50
--   50_plus    — $50+ (open-ended)
--
-- Idempotent ADD COLUMN + DROP/ADD CONSTRAINT so re-running the
-- migration is safe.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS expected_spend_tier text;

ALTER TABLE public.stops
  DROP CONSTRAINT IF EXISTS stops_expected_spend_tier_check;
ALTER TABLE public.stops
  ADD CONSTRAINT stops_expected_spend_tier_check
  CHECK (
    expected_spend_tier IS NULL
    OR expected_spend_tier IN ('free', 'under_5', '5_to_15', '15_to_50', '50_plus')
  );
