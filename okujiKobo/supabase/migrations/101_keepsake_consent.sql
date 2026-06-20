-- Migration 101: per-tester keepsake print consent.
--
-- The journey keepsake reproduces a tester's PRIVATE stamps / journal / photos
-- in print, so generating it is consent-gated: an admin may produce a keepsake
-- ONLY for a tester who has explicitly opted in. keepsake_consent_at is set
-- when a tester is selected into the closed beta (the invite communicates that
-- completing the beta yields a printed keepsake of their stamps, journal, and
-- photos). NULL = no consent → the generator refuses. Never a silent bulk
-- export of private journals.
--
-- Admin-managed (set when selecting a tester). No new RLS policy: profiles RLS
-- already restricts the column; the generator reads it server-side.
--
-- ROLLBACK: drop the column. Additive; modifies no existing row.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS keepsake_consent_at timestamptz;

COMMENT ON COLUMN public.profiles.keepsake_consent_at IS
  'When set, this tester opted in to a printed journey keepsake of their private stamps/journal/photos. Required (non-null) for the admin keepsake generator to run for this user.';
