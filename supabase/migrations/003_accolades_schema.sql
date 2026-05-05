-- Migration 003: Accolades, reading recommendations, teacher notes
-- Run after 001_initial_schema.sql and 002_connect_schema.sql

-- ─────────────────────────────────────────────
-- ALTER STAMPS: accolade flag + FK
-- ─────────────────────────────────────────────

ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS has_accolade    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accolade_id     uuid,
  ADD COLUMN IF NOT EXISTS verified_at     timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by     uuid REFERENCES public.profiles(id);

-- ─────────────────────────────────────────────
-- ACCOLADES
-- Given by rangers, librarians, docents at individual stops.
-- Readable only by the collector who received them and the giver.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accolades (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stamp_id                  uuid REFERENCES public.stamps(id) NOT NULL,
  stop_id                   uuid REFERENCES public.stops(id) NOT NULL,
  user_id                   uuid REFERENCES public.profiles(id) NOT NULL,  -- collector
  given_by                  uuid REFERENCES public.profiles(id) NOT NULL,  -- employee
  giver_role                text NOT NULL,
  giver_institution         text,
  title                     text NOT NULL,
  note                      text CHECK (char_length(note) <= 280),
  given_at                  timestamptz DEFAULT now(),
  nominated_for_rangers_choice  boolean DEFAULT false,
  rangers_choice_year       integer
);

-- Add FK from stamps to accolades (after accolades table exists)
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_accolade_id_fkey
    FOREIGN KEY (accolade_id) REFERENCES public.accolades(id);

-- ─────────────────────────────────────────────
-- READING RECOMMENDATIONS
-- Librarian-attached book suggestions per stamp.
-- Up to 3 per stamp enforced at application layer.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reading_recommendations (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stamp_id          uuid REFERENCES public.stamps(id) NOT NULL,
  user_id           uuid REFERENCES public.profiles(id) NOT NULL,       -- collector
  recommended_by    uuid REFERENCES public.profiles(id) NOT NULL,       -- librarian
  recommender_role  text NOT NULL,
  title             text NOT NULL,
  author            text,
  catalog_url       text,
  note              text CHECK (char_length(note) <= 200),
  recommended_at    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TEACHER NOTES
-- Pre-trip prompts and post-trip responses.
-- Composed asynchronously in PanoplyConnect web — not in Expo app.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teacher_notes (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stop_id             uuid REFERENCES public.stops(id),
  journal_entry_id    uuid REFERENCES public.journal_entries(id),
  student_user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  teacher_user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  note_type           text NOT NULL CHECK (note_type IN ('pre_trip_prompt', 'post_trip_response')),
  content             text NOT NULL CHECK (char_length(content) <= 280),
  created_at          timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- INSTITUTION TYPE — add library tag
-- ─────────────────────────────────────────────

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS institution_type text DEFAULT 'general'
    CHECK (institution_type IN ('general', 'library', 'museum', 'park', 'school', 'historic_site'));

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS catalog_url text;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────

ALTER TABLE public.accolades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_notes         ENABLE ROW LEVEL SECURITY;

-- Accolades: collector who received it OR the employee who gave it
CREATE POLICY "accolades_collector_or_giver" ON public.accolades
  FOR ALL USING (
    user_id   = auth.uid() OR
    given_by  = auth.uid()
  );

-- Reading recommendations: collector who received it OR the librarian
CREATE POLICY "reading_rec_collector_or_librarian" ON public.reading_recommendations
  FOR ALL USING (
    user_id        = auth.uid() OR
    recommended_by = auth.uid()
  );

-- Teacher notes: student OR the teacher who wrote them
CREATE POLICY "teacher_notes_student_or_teacher" ON public.teacher_notes
  FOR ALL USING (
    student_user_id = auth.uid() OR
    teacher_user_id = auth.uid()
  );

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS accolades_stamp_idx        ON public.accolades(stamp_id);
CREATE INDEX IF NOT EXISTS accolades_user_idx         ON public.accolades(user_id);
CREATE INDEX IF NOT EXISTS accolades_given_by_idx     ON public.accolades(given_by);
CREATE INDEX IF NOT EXISTS reading_rec_stamp_idx      ON public.reading_recommendations(stamp_id);
CREATE INDEX IF NOT EXISTS reading_rec_user_idx       ON public.reading_recommendations(user_id);
CREATE INDEX IF NOT EXISTS teacher_notes_student_idx  ON public.teacher_notes(student_user_id);
CREATE INDEX IF NOT EXISTS teacher_notes_teacher_idx  ON public.teacher_notes(teacher_user_id);
CREATE INDEX IF NOT EXISTS stamps_verified_by_idx     ON public.stamps(verified_by);
