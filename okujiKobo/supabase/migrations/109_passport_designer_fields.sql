-- 109_passport_designer_fields.sql
--
-- Additive fields for the automated Passport Designer agent (see
-- docs/passport-markup-spec.md §9/§10 and .claude/agents/passport-designer.md).
-- All columns are nullable with no default, so this is a pure additive
-- migration: existing rows and existing client code are unaffected, and no
-- new mobile binary is required to WRITE them (the designer seeder writes
-- server-side under the service role). RENDERING these on the mobile passport
-- book still requires a new app build — that is out of scope here.
--
-- Why each field (gaps the four designer archetypes kept hitting):
--   stops.description     — a "why this stop" line on the stop itself (not only
--                           a page richtext block), wanted by the foodie/city
--                           archetypes. NOTE: this column already exists on the
--                           live shared backend (it came in with the mobile base
--                           schema, supabase/migrations/001_initial_schema.sql),
--                           so the ADD COLUMN IF NOT EXISTS below is a no-op
--                           there; it is included for completeness and for fresh
--                           DBs built from the okuji-db web baseline, which lacks
--                           it.
--   stops.fun_fact        — one true, interesting fact per stop.
--   stops.fact_source_url — citation backing fun_fact. The design-director
--                           agent rejects an un-sourced fun_fact, so facts the
--                           agent asserts stay honest (CLAUDE.md "honest data").
--   passports.selection_criterion — the machine-readable mandate that explains
--                           why a set of stops belongs together (e.g. "capital
--                           city of each European country"). No existing column
--                           captures a selection rule.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS fun_fact        text,
  ADD COLUMN IF NOT EXISTS fact_source_url text;

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS selection_criterion text;

-- Light integrity guard: a citation URL, when present, must look like a URL.
-- NULL is allowed (most stops carry no fact). Idempotent create.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stops_fact_source_url_format'
  ) THEN
    ALTER TABLE public.stops
      ADD CONSTRAINT stops_fact_source_url_format
      CHECK (fact_source_url IS NULL OR fact_source_url ~* '^https?://');
  END IF;
END $$;

COMMENT ON COLUMN public.stops.description     IS 'One-line "why this stop" copy. Written by the passport designer agent (migration 109).';
COMMENT ON COLUMN public.stops.fun_fact        IS 'A single true, interesting fact about the stop. Must be accompanied by fact_source_url (migration 109).';
COMMENT ON COLUMN public.stops.fact_source_url IS 'Citation URL backing fun_fact; http(s) only (migration 109).';
COMMENT ON COLUMN public.passports.selection_criterion IS 'Machine-readable mandate: why this set of stops belongs together (migration 109).';
