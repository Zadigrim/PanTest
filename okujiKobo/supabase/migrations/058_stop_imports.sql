-- Migration 058: stop_imports
--
-- Records every successful import from the Stop Library. The
-- existing import route at /api/stops/import already SETS
-- stops.original_stop_id on the imported copy (linking child
-- to parent), but that's a stop-level pointer, not a per-
-- import event log. To power:
--
--   * "Imports" stat on the drawer (count of distinct copies
--     made of this source stop),
--   * "My imports" tab (every stop I've imported, with the
--     source stop's metadata still surfaced via join),
--
-- we record one row here per import event.
--
-- Why a separate table instead of just counting stops with
-- original_stop_id = X?
--   * Imports made BEFORE this table existed (i.e. pre-058
--     copies via the old code path) WILL still be findable
--     by `original_stop_id`, but they pre-date import-time
--     attribution. The new table records the importer and
--     time CRISPLY — without ambiguity about whether
--     original_stop_id was authored by user X or just
--     inherited from a chain.
--   * Future "you cited this" + "X institutions imported
--     this stop" surfaces only need this one table.
--
-- ROLLBACK: DROP TABLE. The library UI omits the Imports
-- stat / tab; nothing else breaks.

CREATE TABLE IF NOT EXISTS public.stop_imports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_stop_id  uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  target_stop_id  uuid        NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  importer_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_stop_id)
);

CREATE INDEX IF NOT EXISTS stop_imports_source_idx
  ON public.stop_imports (source_stop_id);
CREATE INDEX IF NOT EXISTS stop_imports_importer_idx
  ON public.stop_imports (importer_id);

ALTER TABLE public.stop_imports ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user — counts are public; per-
-- importer queries filter by importer_id = auth.uid() in
-- the app layer.
DROP POLICY IF EXISTS "stop_imports_read" ON public.stop_imports;
CREATE POLICY "stop_imports_read" ON public.stop_imports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: only your own import. target_stop_id must also be
-- a stop you own (creator_id = auth.uid()) so the bookkeeping
-- can't be poisoned by claiming someone else's stop as
-- "your import".
DROP POLICY IF EXISTS "stop_imports_insert" ON public.stop_imports;
CREATE POLICY "stop_imports_insert" ON public.stop_imports
  FOR INSERT
  WITH CHECK (
    importer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stops s WHERE s.id = target_stop_id AND s.creator_id = auth.uid()
    )
  );
