-- Migration 073: institutions column backfill — defensive ensure for
-- pre-existing additive columns
--
-- Web-tree migration. Idempotent ensure block for every column the
-- /api/institutions POST handler writes. Sourced from migrations
-- 014, 015, 034, 041 — those originals remain unchanged; this file
-- exists because at least one production environment landed with
-- 069/070/071 applied but those earlier institutions-tree
-- migrations skipped (root cause unknown — likely manual SQL
-- application chain that picked migrations selectively).
--
-- Pure ADD COLUMN IF NOT EXISTS — already-present columns are
-- no-ops, zero data change. The verification SELECT at the bottom
-- confirms all 16 columns the create form / API need are present.
--
-- NOT in this file: institutions RLS (migration 026), schema
-- constraints from those source migrations beyond the column
-- defaults, or any column repurposing. If those are also missing
-- in your environment, run the original 014/015/026/034/041 from
-- okujiKobo/supabase/migrations/.
--
-- ROLLBACK: ALTER TABLE public.institutions DROP COLUMN ... for
-- each. Only do this if you're absolutely sure no downstream code
-- reads the column.

ALTER TABLE public.institutions
  -- From 014_blockpoint6 — contact + classification + initial pricing
  ADD COLUMN IF NOT EXISTS institution_type  text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS catalog_url       text,
  ADD COLUMN IF NOT EXISTS charges_admission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_model     text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS contact_name      text,
  ADD COLUMN IF NOT EXISTS contact_email     text,
  ADD COLUMN IF NOT EXISTS website           text,
  ADD COLUMN IF NOT EXISTS address_line1     text,
  ADD COLUMN IF NOT EXISTS address_city      text,
  ADD COLUMN IF NOT EXISTS address_state     text,
  ADD COLUMN IF NOT EXISTS address_zip       text,
  ADD COLUMN IF NOT EXISTS internal_notes    text,
  -- From 015_pricing_model — override mechanism + municipality scale
  ADD COLUMN IF NOT EXISTS municipality_population   integer,
  ADD COLUMN IF NOT EXISTS pricing_model_locked      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_model_override_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_model_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_model_computed    text,
  -- From 041_business_inputs
  ADD COLUMN IF NOT EXISTS annual_revenue   bigint,
  ADD COLUMN IF NOT EXISTS marketing_spend  bigint;

-- 034_institution_tier guarded — only add if missing (default
-- differs across the migration history; 014 used 'community', 034
-- shipped 'pending'; we don't second-guess whatever is in place).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='institutions' AND column_name='tier'
  ) THEN
    ALTER TABLE public.institutions ADD COLUMN tier text NOT NULL DEFAULT 'pending';
  END IF;
END $$;
