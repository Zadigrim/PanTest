-- Migration 020: passport_pages.closed_at — soft-close for published passports with acquisitions
--
-- Mobile-tree migration. passport_pages is mobile-tree-owned
-- (defined in 001), so per the 013 / 017 / 018 precedent any
-- additive ALTER lands here.
--
-- WHY SOFT-CLOSE EXISTS
--
-- For drafts and zero-acquisition passports, the designer's
-- "delete page" performs a physical DELETE that cascades to
-- stops (FK ON DELETE CASCADE) and explicitly deletes any
-- stamps belonging to those stops (no FK cascade on
-- stamps.stop_id; the DELETE route handles that).
--
-- For published passports WITH acquisitions, the preservation
-- invariant (CLAUDE.md #1) forbids losing holder-earned stamps.
-- The DELETE route instead sets closed_at on the page (and on
-- its stops, cascading the existing stop_closure semantics from
-- migration 065). The republish diff (lib/design/republish/
-- diff.ts) detects the new closed_at and categorizes the change
-- as 'page_closure' — a new category added alongside this
-- migration's app-side work, permitted by the verdict per
-- Nathan's M-page-ops ruling.
--
-- Mirrors stops.closed_at (migration 065) exactly. The designer
-- query + every holder-facing read filter WHERE closed_at IS NULL;
-- the snapshot capture (lib/design/republish/snapshot.ts) reads
-- ALL rows including closed so the diff sees the closure event.
--
-- ROLLBACK: ALTER TABLE passport_pages DROP COLUMN closed_at.
-- Safe — every read site falls back to "no closure" naturally
-- when the column is missing.

ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;

-- Partial index speeds the designer + holder reads that filter
-- WHERE closed_at IS NULL. Most pages are NOT closed, so the
-- partial form keeps the index small.
CREATE INDEX IF NOT EXISTS passport_pages_active_idx
  ON public.passport_pages (passport_id, page_order)
  WHERE closed_at IS NULL;
