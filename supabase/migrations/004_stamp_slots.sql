-- Migration 004: stamp_slots table with RLS
-- stamp_slots are designer-only layout elements: they position stamp boxes on a
-- passport page spread. Access mirrors passport_pages — creators manage, public
-- can read slots on published passports.

CREATE TABLE IF NOT EXISTS public.stamp_slots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid        NOT NULL REFERENCES public.passport_pages(id) ON DELETE CASCADE,
  stop_id     uuid        REFERENCES public.stops(id) ON DELETE SET NULL,
  pos_x       numeric     NOT NULL DEFAULT 20 CHECK (pos_x >= 0 AND pos_x <= 100),
  pos_y       numeric     NOT NULL DEFAULT 20 CHECK (pos_y >= 0 AND pos_y <= 100),
  width_pct   numeric     NOT NULL DEFAULT 40 CHECK (width_pct > 0 AND width_pct <= 100),
  height_pct  numeric     NOT NULL DEFAULT 25 CHECK (height_pct > 0 AND height_pct <= 100),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stamp_slots_page_id_idx ON public.stamp_slots(page_id);
CREATE INDEX IF NOT EXISTS stamp_slots_stop_id_idx ON public.stamp_slots(stop_id);

ALTER TABLE public.stamp_slots ENABLE ROW LEVEL SECURITY;

-- Creators can do everything on their own passport's slots
CREATE POLICY "stamp_slots_creator" ON public.stamp_slots
  FOR ALL USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.creator_id = auth.uid()
    )
  );

-- Public can read slots on published passports
CREATE POLICY "stamp_slots_public_read" ON public.stamp_slots
  FOR SELECT USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.is_published = true
    )
  );
