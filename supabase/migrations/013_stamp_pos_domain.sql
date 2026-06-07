-- Migration 013: stamp placement-domain enforcement (KI-08 fix path (a))
--
-- Closes ONE half of the KI-08 finding from the patent investigation:
-- a tampered client could insert a stamps row with stamp_pos_x or
-- stamp_pos_y outside the 0-100 percentage range that the legitimate
-- placement helper (mobile lib/stamp.ts:47-48) produces.
--
-- Legitimate values: percentage offset within the location box's
-- bounding area. computeStampPlacement projects the touch point into
-- the box's local coordinate system, rejects out-of-box centers
-- entirely (returns null), and only then divides by box dimensions
-- to produce a 0..100 percentage. So a legitimate row ALWAYS lies
-- within 0..100 inclusive (boundary values reach 0 and 100 when the
-- touch is exactly on a box edge — included in the constraint).
--
-- This catches out-of-domain tampering only — it does NOT verify
-- that the position falls within the SPECIFIC location element on
-- the page (that would need page geometry in the verify-stamp
-- payload and is fix path (b) per the register). A tampered client
-- can still place a stamp at e.g. (50, 50) of a box whose bounds
-- they ignored. The full check is deferred until the mobile
-- stamping flow routes INSERTs through verify-stamp with a
-- placement payload — which requires a new binary build.
--
-- Existing rows:
--   * Pre-040 stamps may have NULL stamp_pos_x / stamp_pos_y
--     (the gesture-derived position was added with migration 040
--     but the columns existed earlier as nullable floats — see
--     001_initial_schema.sql:146-147). The constraint tolerates
--     NULL via `IS NULL OR …`.
--   * Zero users exist in this environment so there are no legacy
--     percentage values to grandfather; the seed scripts do not
--     INSERT stamps. The constraint is purely forward-protective.
--
-- ROLLBACK: ALTER TABLE public.stamps DROP CONSTRAINT IF EXISTS
-- stamps_pos_x_range, DROP CONSTRAINT IF EXISTS stamps_pos_y_range.

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_pos_x_range;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_pos_x_range
  CHECK (stamp_pos_x IS NULL OR (stamp_pos_x >= 0 AND stamp_pos_x <= 100));

ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_pos_y_range;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_pos_y_range
  CHECK (stamp_pos_y IS NULL OR (stamp_pos_y >= 0 AND stamp_pos_y <= 100));
