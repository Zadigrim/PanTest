-- 028_punch_slots.sql
-- Design-time placeable punch object for moichido (consumable) cards.
--
-- A punch slot is the moichido analogue of a stop's location box, but it is
-- deliberately NOT a stop: a punch is a boolean increment associated with the
-- merchant and the card only — never a GPS-verified place. So this table
-- carries ONLY a position + order (+ optional label) and NONE of stops'
-- location / verification / education / qr machinery (decided with Nathan,
-- 2026-06-14: "punches are much simpler objects … no location data").
--
-- TREE: sibling of stops (001) and punches (018) — a structural passport
-- table, so it lives in the mobile tree. It is authored by the kobo moichido
-- designer; the mobile client never reads it (moichido is QR-only, with no
-- mobile collector app), so this is freeze-safe additive schema — no new
-- mobile binary consumes it.
--
-- RUNTIME LINK: the Nth punch (punches.punch_sequence) fills the Nth slot by
-- slot_order. There is intentionally NO FK from punches to punch_slots —
-- slots are a design-time layout, sequence is the runtime ordering. Removing
-- the legacy punches.stop_id coupling is a later slice.
--
-- RLS mirrors stops_read / stops_creator_manage (migration 001). moichido
-- cards set creator_id = the merchant employee (api/moichido/cards/route.ts),
-- so the creator policy covers the merchant designer.
--
-- ROLLBACK: DROP TABLE public.punch_slots. Nothing reads it until the Slice 2
-- designer wiring lands, so it is safe to drop before then.

CREATE TABLE IF NOT EXISTS public.punch_slots (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id     uuid NOT NULL REFERENCES public.passport_pages(id) ON DELETE CASCADE,
  slot_order  integer NOT NULL,
  -- Position on the canonical 612×792 page (same coordinate space as
  -- stops.box_*). POSITION ONLY — no location/GPS/verification fields.
  box_x       float NOT NULL DEFAULT 0,
  box_y       float NOT NULL DEFAULT 0,
  box_width   float NOT NULL DEFAULT 80,
  box_height  float NOT NULL DEFAULT 80,
  rotation    float NOT NULL DEFAULT 0,
  -- Optional caption beneath the punch (e.g. the reward slot: "free coffee").
  label       text NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, slot_order)
);

CREATE INDEX IF NOT EXISTS punch_slots_page_idx ON public.punch_slots(page_id);

ALTER TABLE public.punch_slots ENABLE ROW LEVEL SECURITY;

-- Read: published card OR the card's creator (mirrors stops_read, mig 001).
DROP POLICY IF EXISTS "punch_slots_read" ON public.punch_slots;
CREATE POLICY "punch_slots_read" ON public.punch_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id
        AND (p.is_published = true OR p.creator_id = auth.uid())
    )
  );

-- Manage: the card's creator (mirrors stops_creator_manage, mig 001).
DROP POLICY IF EXISTS "punch_slots_creator_manage" ON public.punch_slots;
CREATE POLICY "punch_slots_creator_manage" ON public.punch_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id AND p.creator_id = auth.uid()
    )
  );
