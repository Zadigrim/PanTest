-- Migration 004: Stop classifiers, educational fields, connect_roles
-- Run after 001, 002, 003 migrations.

-- ─────────────────────────────────────────────
-- PROFILES: connect_roles for okujiKobo
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS connect_roles text[] DEFAULT '{}';

-- ─────────────────────────────────────────────
-- STOPS: classifiers, educational fields, library sharing
-- ─────────────────────────────────────────────

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS classifiers       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_shared         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at         timestamptz,
  ADD COLUMN IF NOT EXISTS original_stop_id  uuid REFERENCES public.stops(id),
  ADD COLUMN IF NOT EXISTS attribution_note  text,
  ADD COLUMN IF NOT EXISTS grade_levels      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subject_areas     text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS journal_prompt    text;

-- learning_objective already exists from designer migration — ensure it's there
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS learning_objective text;

-- ─────────────────────────────────────────────
-- INSTITUTIONS: ensure institution_type exists (added in 003, idempotent)
-- ─────────────────────────────────────────────

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS institution_type text DEFAULT 'general'
    CHECK (institution_type IN ('general','library','museum','park','school','historic_site')),
  ADD COLUMN IF NOT EXISTS catalog_url text;

-- ─────────────────────────────────────────────
-- INDEXES for stop library queries
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS stops_is_shared_idx       ON public.stops(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS stops_classifiers_idx     ON public.stops USING GIN(classifiers);
CREATE INDEX IF NOT EXISTS stops_grade_levels_idx    ON public.stops USING GIN(grade_levels);
CREATE INDEX IF NOT EXISTS stops_subject_areas_idx   ON public.stops USING GIN(subject_areas);
CREATE INDEX IF NOT EXISTS stops_original_stop_idx   ON public.stops(original_stop_id);
