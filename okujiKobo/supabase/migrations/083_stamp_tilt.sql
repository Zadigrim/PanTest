-- Migration 083: stamp tilt — directional lightness from contact-ellipse rock.
--
-- Sits alongside 040 (saturation + directional smudge). Persists the
-- tilt the collector imparted while pressing, so the stamp re-renders
-- identically every time the passport reopens (appearance is permanent
-- once placed; never recomputed on view).
--
-- Model: a flat press is an isotropic contact (a circle). Rocking the
-- finger flattens the contact into an ellipse — one edge lifts and inks
-- LIGHTER. We record that as a direction + amount:
--
--   tilt_dx, tilt_dy  — unit vector (-1..1 each) pointing toward the
--                       PRESSED (darker) edge; the lifted/lighter edge
--                       is the opposite side. Magnitude ~1 when set.
--   tilt_intensity    — 0..1; 0 = flat even press (no lightening),
--                       1 = strong rock (one edge clearly lighter).
--
-- Signal source (per-platform; Path A):
--   Android — real contact-ellipse read (MotionEvent touch major/minor +
--             orientation) via the local okuji-touch native module.
--   iOS     — no finger contact-orientation API exists; falls back to a
--             drift-direction PROXY (the stamp rocks toward the finger's
--             travel; trailing edge lifts). Documented divergence.
--
-- All nullable to preserve legacy + pre-tilt stamps — they render flat
-- (no tilt lightening) at the renderer's fallback.
--
-- ROLLBACK: drop the four constraints + three columns. Additive; no
-- backfill, existing rows unaffected.

ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS tilt_dx        real,
  ADD COLUMN IF NOT EXISTS tilt_dy        real,
  ADD COLUMN IF NOT EXISTS tilt_intensity real;

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_tilt_dx_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_tilt_dx_check
  CHECK (tilt_dx IS NULL OR (tilt_dx >= -1 AND tilt_dx <= 1));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_tilt_dy_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_tilt_dy_check
  CHECK (tilt_dy IS NULL OR (tilt_dy >= -1 AND tilt_dy <= 1));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_tilt_intensity_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_tilt_intensity_check
  CHECK (tilt_intensity IS NULL OR (tilt_intensity >= 0 AND tilt_intensity <= 1));
