-- 027_journal_entries_unique_stamp.sql
-- Add UNIQUE(stamp_id) to journal_entries so the upsert used by
-- JournalEntry.tsx works. One entry per stamp is the intended model;
-- app/journal/[stampId].tsx presents a single editor per stamp and
-- loads it with .single(). Without this constraint every upsert
-- attempt fails with "no unique or exclusion constraint matching the
-- ON CONFLICT specification" and entries are never written.
--
-- Dedup safety: the upsert path has always failed so no duplicates
-- should exist in production, but the DELETE is idempotent and
-- protects against any rows inserted via a direct client.

BEGIN;

DELETE FROM public.journal_entries
WHERE id NOT IN (
  SELECT DISTINCT ON (stamp_id) id
  FROM public.journal_entries
  ORDER BY stamp_id, updated_at DESC NULLS LAST
);

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_stamp_id_key UNIQUE (stamp_id);

COMMIT;
