-- Migration 018: punches — dedicated table for consumable per-punch records (M2 re-spec)
--
-- Mobile-tree migration. Lives here because it references stops
-- (mobile-tree-owned, 001) and card_instances (mobile-tree-owned, 014).
--
-- DESIGN — DEDICATED TABLE, STAMPS UNTOUCHED
--
-- The M2 re-spec abandons the "teach stamps two semantics" approach
-- (migration 014's stamps changes, reverted by migration 017) in
-- favor of a dedicated table for consumable punches. The trade:
--   * stamps stays byte-identical — every persistent-passport
--     read/write/RLS continues unchanged.
--   * Consumable reads + writes go through punches without any
--     cross-table union.
--   * "Is this row a stamp or a punch?" branching is impossible
--     by construction.
--
-- COLUMNS — slim per Nathan's M2 re-spec ruling
--
-- Included:
--   id, card_instance_id (FK), punch_sequence, user_id, stop_id,
--   punched_at, geohash, verification_method.
--   stamp_pos_x / stamp_pos_y with the 0..100 CHECK from migration
--     013 IF a punch ever renders as a visually placed mark.
--     Included nullable so M4 can opt in without a follow-up
--     migration; CHECK tolerates NULL so an unplaced punch is
--     valid (the typical Clean Loop closing-loop punch will not
--     use these).
--
-- Excluded — moichido's Clean Loop brand direction is closing-loop,
-- not finger-press ink. The gesture-derived appearance encoding from
-- migration 040 (saturation, smudge_dx, smudge_dy, smudge_intensity,
-- contact_size_px, rotation_deg) is okuji's mechanic, not moichido's.
-- "Appearance parity with stamps deferred unless the punch render
-- needs it" — Nathan's M2 re-spec.
--
-- UNIQUENESS
--
-- UNIQUE(card_instance_id, punch_sequence) — sequential numbering
-- within a card, no duplicates.
-- INTENTIONALLY NO UNIQUE on (user_id, stop_id) or (card_instance_id,
-- stop_id). A holder MAY punch the same stop multiple times within
-- one card; per-card sequence is the only ordering constraint.
--
-- user_id DENORMALIZATION
--
-- user_id is denormalized from card_instances → collector_passports
-- for a clean RLS predicate (`user_id = auth.uid()` instead of an
-- EXISTS chain through three tables). NO equality trigger — the M3
-- SECURITY DEFINER write functions are trusted to set user_id
-- consistent with the card_instance's collector_passport's user_id.
-- The trust comes from the writes being concentrated in a single
-- PL/pgSQL surface (M3); a future audit of M3 verifies the
-- consistency.
--
-- RLS — own read + employee-can_verify read, no collector-side
-- INSERT/UPDATE/DELETE policies (M3 SECURITY DEFINER handles
-- writes; service role bypasses).
--
-- ROLLBACK: DROP TABLE. No surface reads from punches at M2 ship
-- time (M3 + M4 hadn't shipped); safe to drop.

CREATE TABLE IF NOT EXISTS public.punches (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id    uuid        NOT NULL REFERENCES public.card_instances(id) ON DELETE CASCADE,
  punch_sequence      integer     NOT NULL,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id),
  stop_id             uuid        NOT NULL REFERENCES public.stops(id),
  punched_at          timestamptz NOT NULL DEFAULT now(),
  geohash             text        NULL,
  verification_method text        NULL,
  -- Optional visual placement — see header for why these are
  -- nullable. CHECK matches migration 013's stamps_pos_x/y_range
  -- shape so the domain rule is identical across the two row
  -- types if M4 chooses to render punches with position.
  stamp_pos_x         float       NULL,
  stamp_pos_y         float       NULL,
  UNIQUE (card_instance_id, punch_sequence)
);

ALTER TABLE public.punches
  DROP CONSTRAINT IF EXISTS punches_pos_x_range;
ALTER TABLE public.punches
  ADD CONSTRAINT punches_pos_x_range
  CHECK (stamp_pos_x IS NULL OR (stamp_pos_x >= 0 AND stamp_pos_x <= 100));

ALTER TABLE public.punches
  DROP CONSTRAINT IF EXISTS punches_pos_y_range;
ALTER TABLE public.punches
  ADD CONSTRAINT punches_pos_y_range
  CHECK (stamp_pos_y IS NULL OR (stamp_pos_y >= 0 AND stamp_pos_y <= 100));

-- Indexes — read paths the M3/M4 surfaces will hit.
-- Punches for a given card, in sequence order (the typical
-- punch-card display).
CREATE INDEX IF NOT EXISTS punches_card_instance_seq_idx
  ON public.punches (card_instance_id, punch_sequence);

-- Holder's punch history across all cards (the holder's library
-- view). Uses denormalized user_id directly.
CREATE INDEX IF NOT EXISTS punches_user_idx
  ON public.punches (user_id, punched_at DESC);

ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;

-- Holder reads own punches. Direct equality on the denormalized
-- user_id — no EXISTS chain. is_admin bypasses.
DROP POLICY IF EXISTS "punches_own_read" ON public.punches;
CREATE POLICY "punches_own_read" ON public.punches
  FOR SELECT
  USING (
    public.is_admin() = true
    OR user_id = auth.uid()
  );

-- Terminal-side reads — employees with can_verify at the
-- proprietor institution. The chain is punches → card_instances →
-- collector_passports → passports → proprietor_id.
DROP POLICY IF EXISTS "punches_employee_read" ON public.punches;
CREATE POLICY "punches_employee_read" ON public.punches
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1
      FROM public.card_instances ci
      JOIN public.collector_passports cp ON cp.id = ci.collector_passport_id
      JOIN public.passports p ON p.id = cp.passport_id
      JOIN public.employee_authorizations ea ON ea.institution_id = p.proprietor_id
      WHERE ci.id = punches.card_instance_id
        AND ea.user_id = auth.uid()
        AND ea.can_verify = true
    )
  );

-- No INSERT / UPDATE / DELETE policies. M3 SECURITY DEFINER
-- functions handle writes via service role. Non-admin direct
-- writes denied.
