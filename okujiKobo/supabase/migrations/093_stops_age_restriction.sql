-- 093_stops_age_restriction.sql
--
-- Stop-level age/restriction indicator — the AUP's creator-disclosure
-- mechanism for age-restricted venues. Mirrors the passport-level
-- accessibility-indicator pattern (transit_accessible / wheelchair_accessible,
-- migration 002): a small enumerated field on the row, surfaced by a
-- designer control and an indicator on the stop.
--
-- Enum (not a bare boolean) so the disclosure says which restriction
-- applies: 'none' (default), '18_plus', '21_plus'.
--
-- A passport-level "contains age-restricted locations" advisory is DERIVED
-- at read time from these flags (EXISTS over the passport's stops) — no
-- separate manual toggle, no trigger-maintained column.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS age_restriction text NOT NULL DEFAULT 'none'
    CHECK (age_restriction IN ('none', '18_plus', '21_plus'));
