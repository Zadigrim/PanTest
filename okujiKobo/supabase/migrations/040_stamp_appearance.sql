-- Expressive stamp gesture: persist the four new appearance properties
-- computed by the gesture so a stamp re-renders identically each time
-- the passport is reopened. The stamp's appearance is permanent once
-- placed; values are NOT recomputed on view.
--
-- All four are nullable to preserve legacy stamps (rows placed before
-- this PR) — they fall back to discrete defaults at the render layer
-- (saturation 1.0; smudge from stops.stamp_smudge enum; no directional
-- ghost).
--
-- saturation        — 0..1 scalar; renderer applies as opacity
-- smudge_dx, smudge_dy — unit vector (-1..1) of the smear's direction;
--                     magnitude == sqrt(dx^2 + dy^2) is 1.0 when set
-- smudge_intensity  — 0..1 scalar; 0 = crisp stamp, 1 = full smear
--
-- The proxies driving these values are:
--   - duration of press (0..2s) -> contact_size_px (existing col) +
--     saturation (this migration)
--   - initial movement vector  -> rotation_deg (existing col)
--   - net path of the press    -> smudge_dx, smudge_dy, smudge_intensity
--
-- The duration->size and initial-vector->rotation paths are PROXIES for
-- contact-area and contact-ellipse-orientation, not native reads.
-- The movement->smudge path is a real read of the gesture.

ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS saturation       real,
  ADD COLUMN IF NOT EXISTS smudge_dx        real,
  ADD COLUMN IF NOT EXISTS smudge_dy        real,
  ADD COLUMN IF NOT EXISTS smudge_intensity real;

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_saturation_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_saturation_check
  CHECK (saturation IS NULL OR (saturation >= 0 AND saturation <= 1));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_smudge_intensity_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_smudge_intensity_check
  CHECK (smudge_intensity IS NULL OR (smudge_intensity >= 0 AND smudge_intensity <= 1));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_smudge_dx_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_smudge_dx_check
  CHECK (smudge_dx IS NULL OR (smudge_dx >= -1 AND smudge_dx <= 1));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_smudge_dy_check;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_smudge_dy_check
  CHECK (smudge_dy IS NULL OR (smudge_dy >= -1 AND smudge_dy <= 1));
