-- Add stamp-box position columns to the mobile stops table.
--
-- The book renderer (components/passport/DesignerCanvas.tsx) reads stamp-box
-- positions from stop.box_x / stop.box_y / box_width / box_height. The mobile
-- schema previously didn't have these columns, so mobile-designed passports
-- rendered zero stamp boxes — a creator could build a stop but a collector
-- couldn't see anywhere to stamp it. Positioning was supposed to live in the
-- stamp_slots table (migration 004), but the renderer doesn't read that table
-- and the designer never linked slots to stops.
--
-- This migration aligns the schema with what the renderer and TypeScript
-- types already expect. The stamp_slots table is left in place but is no
-- longer the source of truth; the mobile designer now writes box_* on the
-- stop row directly.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS box_x      numeric,
  ADD COLUMN IF NOT EXISTS box_y      numeric,
  ADD COLUMN IF NOT EXISTS box_width  numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS box_height numeric NOT NULL DEFAULT 30;

-- Backfill existing rows with spaced default positions so multiple stops on
-- the same page don't all stack at the same coordinates. Uses stop_order to
-- offset within the page. Numbers are percentages of the page (0–100).
UPDATE public.stops
SET box_x = COALESCE(box_x, 5 + (stop_order * 5) % 50),
    box_y = COALESCE(box_y, 5 + (stop_order * 7) % 60)
WHERE box_x IS NULL OR box_y IS NULL;
