-- Migration 065: stops.closed_at
--
-- Permanent-closure marker for individual stops. NULL = open
-- (the default for every existing row). Non-NULL = the stop
-- is closed; the creator decided this during a correction
-- republish.
--
-- Holder-side rendering (spec invariant):
--   * A closed stop renders MARKED AS CLOSED on the holder's
--     passport — it does NOT vanish from the page.
--   * Existing stamps on a closed stop SURVIVE — the
--     collector's record is permanent. A holder who earned
--     a stamp at a now-closed stop continues to see the
--     stamp; the stop label adopts a "Closed {date}"
--     subtitle.
--   * No stamp can be EARNED on a closed stop (the verify
--     edge function would normally check this, but the
--     guard lives at the application layer so already-
--     stamped holders are unaffected).
--
-- closed_at is a TIMESTAMP not a boolean so the holder
-- notice can render the closure date ("Closed Mar 12, 2026")
-- without a second lookup.
--
-- ROLLBACK: DROP COLUMN. The holder-side rendering loses
-- the closed marker but stamps/journals remain (they're
-- stored on stamps / journal_entries, independent of this
-- column).

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

-- Index for the rare "list all closed stops on a passport"
-- query (admin tooling). Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS stops_closed_at_idx
  ON public.stops (page_id)
  WHERE closed_at IS NOT NULL;
