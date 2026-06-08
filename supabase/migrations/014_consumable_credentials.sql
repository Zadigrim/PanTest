-- Migration 014: consumable credential — card_instances + stamps constraint replacement (M2)
--
-- Mobile-tree migration. Lives here because it modifies stamps
-- (mobile-tree-owned, defined in 001) and creates card_instances
-- which FKs to collector_passports (mobile-tree-owned). Same
-- precedent as 013 (stamps CHECK constraint).
--
-- DEPLOY ORDER: this migration runs AFTER web-tree 069
-- (passports.credential_type + distribution_only). No direct
-- dependency between this file and 069, but the M2 conceptual
-- bundle needs both for the consumable path to be coherent.
--
-- THE TWO STRUCTURAL CHANGES:
--
-- (1) NEW TABLE: card_instances
--     One row per "card the holder currently has" — for
--     consumable passports, a holder may receive multiple
--     instances sequentially (consume one, get another). All
--     instances FK to a single long-lived collector_passports
--     row (the holder's possession record for that passport
--     design).
--
--     Constraints:
--       UNIQUE (collector_passport_id, sequence) — sequential
--         numbering, no duplicates.
--       Partial unique on (collector_passport_id) WHERE
--         consumed_at IS NULL — enforces one ACTIVE instance
--         per acquisition. Issuing a new instance is blocked
--         until the current one is consumed.
--
--     consumed_at IS state, never DELETE — preservation
--     invariant per CLAUDE.md #1. No DELETE policy below;
--     admins can still delete via service role but no app
--     surface deletes consumed cards.
--
-- (2) STAMPS: replace table-level UNIQUE(user_id, stop_id)
--     with two partial unique indexes. The persistent semantics
--     branch is byte-equivalent to the old constraint for any
--     row with card_instance_id IS NULL; the consumable branch
--     permits per-instance stamping.
--
--     The old constraint is auto-named stamps_user_id_stop_id_key
--     by Postgres. We drop by name (with IF EXISTS for safety
--     on re-run) and create the two partial indexes.
--
--     EQUIVALENCE: for every persistent stamp (now and forever),
--     card_instance_id IS NULL. The partial index
--     stamps_user_stop_persistent has the same uniqueness
--     predicate as the original UNIQUE for those rows. Zero
--     behavior change to the persistent stamping flow.
--
-- RLS on card_instances mirrors stamps RLS:
--   - card_instances_own_read: holder reads via the FK chain
--     collector_passports.user_id = auth.uid(). is_admin
--     bypasses.
--   - card_instances_employee_read: institution employees with
--     can_verify at the proprietor institution can SELECT (the
--     terminal needs to know which instance to consume).
--   - No INSERT / UPDATE / DELETE policies for non-admins —
--     M3's SECURITY DEFINER issue/consume functions handle the
--     write semantics.
--
-- ROLLBACK: drop card_instances cascade, restore
--   UNIQUE(user_id, stop_id) on stamps via DROP INDEX +
--   ALTER TABLE ADD CONSTRAINT. Only safe if no consumable
--   stamp row exists (i.e. no row with card_instance_id IS
--   NOT NULL). Zero users → no risk today.

-- ─── card_instances ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_passport_id uuid NOT NULL REFERENCES public.collector_passports(id) ON DELETE CASCADE,
  sequence              integer NOT NULL,
  issued_at             timestamptz NOT NULL DEFAULT now(),
  consumed_at           timestamptz NULL,
  UNIQUE (collector_passport_id, sequence)
);

-- One active instance per acquisition. A second active instance
-- can only land after the prior one's consumed_at is set.
CREATE UNIQUE INDEX IF NOT EXISTS card_instances_one_active_per_acq
  ON public.card_instances (collector_passport_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS card_instances_collector_passport_idx
  ON public.card_instances (collector_passport_id);

ALTER TABLE public.card_instances ENABLE ROW LEVEL SECURITY;

-- Holder reads own card_instances via collector_passports FK.
DROP POLICY IF EXISTS "card_instances_own_read" ON public.card_instances;
CREATE POLICY "card_instances_own_read" ON public.card_instances
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.collector_passports cp
      WHERE cp.id = card_instances.collector_passport_id
        AND cp.user_id = auth.uid()
    )
  );

-- Terminal-side reads — employees with can_verify at the
-- proprietor institution. The chain is card_instances →
-- collector_passports → passports → proprietor_id.
DROP POLICY IF EXISTS "card_instances_employee_read" ON public.card_instances;
CREATE POLICY "card_instances_employee_read" ON public.card_instances
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1
      FROM public.collector_passports cp
      JOIN public.passports p ON p.id = cp.passport_id
      JOIN public.employee_authorizations ea ON ea.institution_id = p.proprietor_id
      WHERE cp.id = card_instances.collector_passport_id
        AND ea.user_id = auth.uid()
        AND ea.can_verify = true
    )
  );

-- No INSERT / UPDATE / DELETE policies. M3 issue + consume
-- functions run as SECURITY DEFINER (service role) and bypass
-- RLS for those writes. Non-admin direct writes denied.

-- ─── stamps: card_instance_id + constraint replacement ──────────
ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS card_instance_id uuid NULL
  REFERENCES public.card_instances(id) ON DELETE SET NULL;

-- Drop the table-level UNIQUE constraint (auto-named
-- stamps_user_id_stop_id_key). IF EXISTS for re-run safety.
ALTER TABLE public.stamps
  DROP CONSTRAINT IF EXISTS stamps_user_id_stop_id_key;

-- Persistent semantics: one (user, stop) per persistent stamp.
-- Byte-equivalent to the prior constraint for any row with
-- card_instance_id IS NULL (which is every row today and every
-- persistent stamp in perpetuity).
CREATE UNIQUE INDEX IF NOT EXISTS stamps_user_stop_persistent
  ON public.stamps (user_id, stop_id)
  WHERE card_instance_id IS NULL;

-- Consumable semantics: one (user, stop, instance) per
-- consumable stamp. A new card_instance issued to the same user
-- gets a fresh (user, stop, instance) tuple and may stamp the
-- same stop again.
CREATE UNIQUE INDEX IF NOT EXISTS stamps_user_stop_per_instance
  ON public.stamps (user_id, stop_id, card_instance_id)
  WHERE card_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stamps_card_instance_idx
  ON public.stamps (card_instance_id)
  WHERE card_instance_id IS NOT NULL;
