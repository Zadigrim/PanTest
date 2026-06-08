-- Migration 071: passports.consumable_target_count — design-time default punch count (M3)
--
-- Web-tree migration. Companion to mobile-tree 021 which adds the
-- function surface for the consumable credential loop. The two
-- migrations are conceptually one unit; deploy 071 first (021's
-- ensure_collector_passport refers to this column when seeding
-- the first card_instance for a consumable passport).
--
-- ADDED COLUMN — passports.consumable_target_count
--
--   integer NULL.
--   Meaningful only when credential_type='consumable'. The default
--   number of punches a freshly-issued card_instances row carries
--   for this passport — i.e. "this is a 10-punch card." The first
--   card_instance for a holder is seeded with this value when the
--   acquisition path mirrors collector_passports
--   (ensure_collector_passport, migration 021). Per-card overrides
--   live on card_instances.target_count (mobile-tree 021); the
--   prepaid variant uses arbitrary per-card values without
--   touching this column.
--
--   NULL is permitted so existing persistent passports don't need a
--   meaningful value. The 021 function refuses to seed a card_instance
--   if credential_type='consumable' and this column is NULL — the
--   intent is the designer surface (M4) writes it explicitly.
--
-- ROLLBACK: ALTER TABLE … DROP COLUMN consumable_target_count.
-- Safe — no read path outside ensure_collector_passport (021) and
-- a future M4 designer surface; both tolerate the column missing
-- (021 would error at seed time, designer simply doesn't surface it).

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS consumable_target_count integer NULL;

ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_consumable_target_count_positive;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_consumable_target_count_positive
  CHECK (consumable_target_count IS NULL OR consumable_target_count > 0);
