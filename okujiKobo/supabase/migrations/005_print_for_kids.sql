-- Migration 005: Print for Kids physical passport
-- Institutional accounts only — schools, libraries, parks.
-- Run after 001–004.

-- ─────────────────────────────────────────────
-- PASSPORTS: print settings
-- ─────────────────────────────────────────────

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS print_enabled         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_journal_setting text    DEFAULT 'include_all'
    CHECK (print_journal_setting IN ('include_all', 'exclude_all', 'per_stop'));

-- ─────────────────────────────────────────────
-- STOPS: per-stop journal toggle for print
-- ─────────────────────────────────────────────

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS print_include_journal boolean DEFAULT true;

-- ─────────────────────────────────────────────
-- PRINT JOBS: audit log
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id     uuid         REFERENCES public.passports(id)    NOT NULL,
  institution_id  uuid         NOT NULL,
  created_by      uuid         REFERENCES public.profiles(id)     NOT NULL,
  stop_ids        uuid[]       NOT NULL,
  copies          integer      NOT NULL CHECK (copies > 0),
  journal_setting text         NOT NULL
    CHECK (journal_setting IN ('per_stop', 'include_all', 'exclude_all')),
  created_at      timestamptz  DEFAULT now()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Only the user who created the print job can read or write it.
CREATE POLICY "print_jobs_own" ON public.print_jobs
  FOR ALL USING (created_by = auth.uid());

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS print_jobs_passport_idx     ON public.print_jobs(passport_id);
CREATE INDEX IF NOT EXISTS print_jobs_institution_idx  ON public.print_jobs(institution_id);
CREATE INDEX IF NOT EXISTS print_jobs_created_by_idx   ON public.print_jobs(created_by);
