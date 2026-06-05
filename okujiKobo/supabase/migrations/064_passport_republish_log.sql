-- Migration 064: passport_republish_log
--
-- Audit log for every republish to existing holders. Records
-- the creator's justification, the holder-facing
-- what-changed line, the diff summary the gate computed, and
-- any admin override.
--
-- This is the v1 moderation surface for the correction-only
-- republish model. Platform admins read this to audit
-- creators who flag the factual-text category often
-- (cosmetic polish disguised as a correction) or who use
-- the override path.
--
-- Schema rationale:
--   justification      — creator's required note ("Lime
--                        Kiln coordinates were 400m off")
--   what_changed       — short holder-facing line shown in
--                        the dismissible notice ("Coordinates
--                        corrected for two stops").
--   diff_summary       — { location_data: 2, verification_mechanics:
--                          0, stop_closure: 0, factual_text: 1,
--                          other: 0 } — counts per category.
--   factual_text_flagged — true iff factual_text > 0. Mirrored
--                          out of diff_summary so admin queries
--                          don't need jsonb indexing.
--   admin_override     — true iff a non-creator admin
--                        approved a republish that would
--                        otherwise have been blocked
--                        (because 'other' > 0). The override
--                        path explicitly records who did it.
--
-- ROLLBACK: DROP TABLE. The republish route falls back to
-- "log to console only" (degraded but not broken).

CREATE TABLE IF NOT EXISTS public.passport_republish_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id          uuid        NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  republished_at       timestamptz NOT NULL DEFAULT now(),
  republished_by       uuid        NULL REFERENCES public.profiles(id),
  justification        text        NOT NULL CHECK (char_length(justification) BETWEEN 10 AND 1000),
  what_changed         text        NOT NULL CHECK (char_length(what_changed)  BETWEEN  3 AND  200),
  diff_summary         jsonb       NOT NULL,
  factual_text_flagged boolean     NOT NULL DEFAULT false,
  admin_override       boolean     NOT NULL DEFAULT false,
  admin_override_by    uuid        NULL REFERENCES public.profiles(id),
  CONSTRAINT republish_override_pairing CHECK (
    (admin_override = false AND admin_override_by IS NULL)
    OR (admin_override = true AND admin_override_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS passport_republish_log_passport_idx
  ON public.passport_republish_log (passport_id, republished_at DESC);
CREATE INDEX IF NOT EXISTS passport_republish_log_flagged_idx
  ON public.passport_republish_log (republished_at DESC)
  WHERE factual_text_flagged = true OR admin_override = true;

ALTER TABLE public.passport_republish_log ENABLE ROW LEVEL SECURITY;

-- SELECT: passport creator (sees their own log) + platform
-- admin (sees everything for moderation).
DROP POLICY IF EXISTS "republish_log_read" ON public.passport_republish_log;
CREATE POLICY "republish_log_read" ON public.passport_republish_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.is_platform_admin = true
    )
  );

-- INSERT: only the republish route, which uses the service
-- role to bypass RLS. Direct writes are denied so the audit
-- log can't be poisoned.
DROP POLICY IF EXISTS "republish_log_insert" ON public.passport_republish_log;
CREATE POLICY "republish_log_insert" ON public.passport_republish_log
  FOR INSERT
  WITH CHECK (false);
