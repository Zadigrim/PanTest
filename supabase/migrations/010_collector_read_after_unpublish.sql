-- Preserve existing-collector access when a passport is unpublished.
--
-- Before this migration, pages_read and stops_read gated SELECT on
--   (p.is_published = true OR p.creator_id = auth.uid())
-- meaning if a creator flipped is_published to false, every collector who
-- already acquired the passport lost SELECT on its pages and stops — the book
-- reader broke for them. Their collector_passports / acquisitions rows
-- granted no transitive read on passport_pages or stops.
--
-- This migration broadens both policies to additionally allow SELECT when the
-- caller already holds an acquisition record for the passport (in either the
-- mobile collector_passports table or the web acquisitions table). The
-- semantics become:
--   "Unpublished passports are readable by creator, by existing collectors,
--    and (when published) by anyone."
--
-- Net effect: unpublishing now reliably stops new acquisitions (the acquire
-- API already 403s on !is_published) without breaking the book reader for
-- anyone who already owns a copy. Republish is a clean toggle.
--
-- If either collector_passports or acquisitions does not exist in your
-- database (the README notes the live schema needs human confirmation),
-- comment out the corresponding EXISTS clause before applying.

DROP POLICY IF EXISTS "pages_read" ON public.passport_pages;
CREATE POLICY "pages_read" ON public.passport_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id
        AND (
          p.is_published = true
          OR p.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.collector_passports cp
            WHERE cp.passport_id = p.id AND cp.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.acquisitions a
            WHERE a.passport_id = p.id AND a.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "stops_read" ON public.stops;
CREATE POLICY "stops_read" ON public.stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id
        AND (
          p.is_published = true
          OR p.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.collector_passports cp
            WHERE cp.passport_id = p.id AND cp.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.acquisitions a
            WHERE a.passport_id = p.id AND a.user_id = auth.uid()
          )
        )
    )
  );
