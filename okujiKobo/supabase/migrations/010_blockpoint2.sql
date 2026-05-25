-- Migration 010: Blockpoint 2 — institution types, stop library indexes
-- Run after 001–009.

-- ─── institutions: update type constraint to include new types ────────────────
ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_type_check;

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_type_check
  CHECK (institution_type IN (
    'general',
    'k12_school', 'public_library', 'museum', 'parks_department',
    'aquarium', 'zoo', 'nature_conservatory',
    'nonprofit', 'municipality', 'chamber_of_commerce',
    'tourism_board', 'proprietor', 'hotel_chain', 'expo_organizer',
    -- legacy values kept for backwards compatibility
    'library', 'park', 'school', 'historic_site',
    'other'
  ));

-- ─── stops: ensure classifiers and sharing columns exist ─────────────────────
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS classifiers text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_shared   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at   timestamptz;

-- ─── stops: performance index for stop library queries ───────────────────────
CREATE INDEX IF NOT EXISTS stops_educational_shared
  ON public.stops (is_shared, classifiers)
  WHERE is_shared = true;
