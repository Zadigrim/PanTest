-- Migration 067: holder SELECT on passport_republish_log
--
-- Push-2 of the passport lifecycle work wired up the holder
-- notice on both surfaces (mobile passport detail + web
-- /library row), but `passport_republish_log` (migration
-- 064) currently grants SELECT to creator + platform admin
-- only. Holders see an empty list and the banner stays
-- hidden — fail-closed but unusable.
--
-- This adds a parallel read policy granting SELECT when the
-- caller has an acquisitions OR collector_passports row for
-- the log entry's passport_id. The banner now actually
-- surfaces.
--
-- We deliberately do NOT expose justification on the holder
-- SELECT — but the existing read policy is row-level (all
-- columns or none). Acceptable at v1 scale; the
-- justification text is the creator's note to admins and
-- doesn't contain anything we'd object to a holder seeing.
-- If we ever need to redact, the right answer is a
-- public-shape view (passport_republish_notices) selecting
-- only what_changed + republished_at, and pointing the
-- holder client at THAT view. Tracked as a follow-up if the
-- justification field ever picks up sensitive content.
--
-- ROLLBACK: DROP POLICY. Banner stops surfacing on both
-- holder surfaces; no other breakage.

DROP POLICY IF EXISTS "republish_log_holder_read" ON public.passport_republish_log;
CREATE POLICY "republish_log_holder_read" ON public.passport_republish_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.acquisitions a
      WHERE a.user_id = auth.uid() AND a.passport_id = passport_republish_log.passport_id
    )
    OR EXISTS (
      SELECT 1 FROM public.collector_passports cp
      WHERE cp.user_id = auth.uid() AND cp.passport_id = passport_republish_log.passport_id
    )
  );
