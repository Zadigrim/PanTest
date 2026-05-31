-- Capture inputs the future Business-tier pricing function will need.
--
-- The pricing model for Business-tier institutions will be a function of
-- annual_revenue and marketing_spend. Both are deliberately captured-only
-- in this PR — no computation, no constraint on either field beyond
-- non-negative. The pricing model itself is deferred until real deal
-- data exists.
--
-- Both columns are nullable: Civic and Municipal institutions don't need
-- them; even Business institutions can be provisioned without them and
-- have them filled in later. The UI conditionally surfaces these fields
-- only when institutions.tier = 'business'.
--
-- Numeric typing notes:
--   - annual_revenue stored as bigint (whole dollars sufficient; cents are
--     not the modeling unit at this scale).
--   - marketing_spend stored as bigint for the same reason. If finer
--     granularity is ever needed, ALTER to numeric(14,2).

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS annual_revenue   bigint,
  ADD COLUMN IF NOT EXISTS marketing_spend  bigint;

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_annual_revenue_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_annual_revenue_check
  CHECK (annual_revenue IS NULL OR annual_revenue >= 0);

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_marketing_spend_check;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_marketing_spend_check
  CHECK (marketing_spend IS NULL OR marketing_spend >= 0);
