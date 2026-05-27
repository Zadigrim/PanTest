-- Journal photos: private per-user Supabase Storage + metadata table.
-- Photos were previously stored only as local device file:// URIs on the
-- journal_entries.photo_urls array; this migration adds durable storage.

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Private (not public). 5 MB hard cap as a backstop (the app resizes the long
-- edge to <=3000px before upload, so this rarely fires). No allowed_mime_types
-- restriction so HEIC/HEIF upload as-is without content-type rejection.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('journal-photos', 'journal-photos', false, 5242880)
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 5242880;

-- Per-user folder enforcement. Path layout:
--   journal-photos/{user_id}/{journal_entry_id}/{photo_id}.{ext}
-- The first path segment must equal the caller's auth uid for every operation.
DROP POLICY IF EXISTS "journal_photos_insert" ON storage.objects;
CREATE POLICY "journal_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "journal_photos_select" ON storage.objects;
CREATE POLICY "journal_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "journal_photos_delete" ON storage.objects;
CREATE POLICY "journal_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Metadata table ────────────────────────────────────────────────────────────
-- One row per photo. Supports the offline upload lifecycle and lost-photo
-- tracking. The actual bytes live in storage; this table only holds the path
-- and metadata.
CREATE TABLE IF NOT EXISTS public.journal_photos (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id  uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id),
  storage_path      text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','uploaded','failed','lost')),
  original_filename text,
  width_before      integer,
  height_before     integer,
  width_after       integer,
  height_after      integer,
  byte_size         integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_photos_entry_idx ON public.journal_photos(journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_photos_user_idx  ON public.journal_photos(user_id);

ALTER TABLE public.journal_photos ENABLE ROW LEVEL SECURITY;

-- A user can only ever see/modify their own photo rows.
DROP POLICY IF EXISTS "journal_photos_own" ON public.journal_photos;
CREATE POLICY "journal_photos_own" ON public.journal_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reuse the updated_at trigger function defined in 001_initial_schema.sql.
DROP TRIGGER IF EXISTS journal_photos_updated_at ON public.journal_photos;
CREATE TRIGGER journal_photos_updated_at
  BEFORE UPDATE ON public.journal_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
