-- Migration 017: revert stamps modifications from migration 014 (M2 re-spec)
--
-- COMPENSATING MIGRATION. Migration 014 added stamps.card_instance_id
-- and replaced the table-level UNIQUE(user_id, stop_id) constraint
-- with two partial unique indexes (stamps_user_stop_persistent,
-- stamps_user_stop_per_instance). The M2 re-spec abandons that
-- approach in favor of a dedicated punches table (migration 018) —
-- stamps stays byte-identical to its pre-1a8a078 shape.
--
-- This migration is safe because:
--   * Zero users exist in the environment when this runs.
--   * No code surface ever wrote a non-NULL card_instance_id to
--     stamps (the consumable issuing functions are M3, not M2).
--   * Every existing stamps row therefore has card_instance_id IS
--     NULL, and the original UNIQUE(user_id, stop_id) constraint
--     re-applies without conflict.
--
-- If any consumable stamp row had been written between 1a8a078 and
-- this migration, the ADD CONSTRAINT below would fail on duplicates.
-- That scenario is impossible today (no insert path exists); future
-- agents reading this should know that path was never live.
--
-- Order: drop the indexes first (they're partial unique indexes
-- BUT not constraints, so DROP INDEX is the correct verb). Then
-- drop the column. Then add the original constraint back.
--
-- ROLLBACK: re-apply migration 014's stamps changes.

-- (1) Drop the two partial unique indexes added by migration 014.
DROP INDEX IF EXISTS public.stamps_user_stop_persistent;
DROP INDEX IF EXISTS public.stamps_user_stop_per_instance;
DROP INDEX IF EXISTS public.stamps_card_instance_idx;

-- (2) Drop the column added by migration 014. CASCADE not needed
-- since no FK points at it; the FK direction was stamps →
-- card_instances (the column being dropped is the referring side).
ALTER TABLE public.stamps
  DROP COLUMN IF EXISTS card_instance_id;

-- (3) Restore the original UNIQUE(user_id, stop_id) constraint.
-- Postgres auto-named the original constraint stamps_user_id_stop_id_key;
-- re-creating it with the same name preserves any downstream
-- references that depended on the name (none in this codebase,
-- but the consistency matters for diff readability against 001).
ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_user_id_stop_id_key;
ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_user_id_stop_id_key
  UNIQUE (user_id, stop_id);

-- card_instances table from 014 STAYS — it's still the model for
-- consumable issuance. Only the stamps-side modifications get
-- reverted. The new punches table (migration 018) references
-- card_instances directly.

-- After this migration runs, stamps is byte-identical to its
-- shape as of migration 013 (which only added the stamp_pos_x/y
-- CHECK constraints, unrelated to this revert).
