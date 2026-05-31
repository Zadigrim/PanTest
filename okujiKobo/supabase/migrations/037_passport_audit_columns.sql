-- Phase 1, DEC-18 audit support: last_edited_by + last_edited_at on
-- passports, plus a BEFORE UPDATE trigger that fills them automatically.
--
-- DEC-18 grants institutional employees with can_design the ability to
-- edit passports their institution owns. This audit trail makes the
-- "who last touched this" question answerable without building a full
-- audit log feature.
--
-- Trigger-based rather than app-layer (deviates from the roadmap entry
-- on DEC-18). Justification, surfaced in discovery and confirmed:
-- there are ~19 passport UPDATE call sites across web and mobile,
-- many direct PostgREST client calls from designer UI components.
-- App-layer-only would mean 19 nearly-identical edits and a recurring
-- "did you remember the stamp" review burden on every future PR.
-- The trigger is one place, runs after RLS, can't be spoofed.
--
-- last_edited_by is set from auth.uid(). For service-role API routes
-- (tip arrival, acquire arrival, completion notification, admin
-- recompute), auth.uid() is NULL — which is the desired semantic:
-- system-driven derived-counter updates produce last_edited_by = NULL,
-- distinguishing them from human edits.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_passport_last_edited()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_edited_at := now();
  NEW.last_edited_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS passports_last_edited ON public.passports;
CREATE TRIGGER passports_last_edited
  BEFORE UPDATE ON public.passports
  FOR EACH ROW EXECUTE FUNCTION public.set_passport_last_edited();
