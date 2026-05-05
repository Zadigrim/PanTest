-- Migration 006: Design assets table
-- Stores backgrounds, stamps, and cover images uploaded by creators/institutions.

CREATE TABLE IF NOT EXISTS public.design_assets (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        uuid         REFERENCES public.profiles(id) NOT NULL,
  institution_id  uuid         REFERENCES public.institutions(id),
  name            text,
  asset_type      text         NOT NULL
    CHECK (asset_type IN ('background', 'stamp', 'cover')),
  url             text,
  storage_path    text,
  created_at      timestamptz  DEFAULT now()
);

ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;

-- Owners can read/write their own assets
CREATE POLICY "design_assets_owner" ON public.design_assets
  FOR ALL USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS design_assets_owner_idx        ON public.design_assets(owner_id);
CREATE INDEX IF NOT EXISTS design_assets_institution_idx  ON public.design_assets(institution_id);
CREATE INDEX IF NOT EXISTS design_assets_type_idx         ON public.design_assets(asset_type);
