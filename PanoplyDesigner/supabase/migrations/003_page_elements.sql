-- ─────────────────────────────────────────────
-- PAGE ELEMENTS (text labels, H/V lines)
-- Stored as JSONB array on passport_pages.
-- Each element: { id, type, x, y, width, height, ...typeFields }
-- ─────────────────────────────────────────────
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS elements jsonb NOT NULL DEFAULT '[]'::jsonb;
