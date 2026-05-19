-- Migration 009: Blockpoint 1 — Google OAuth support, design_state, autosaves
-- Run after 001–008.

-- ─── profiles: auth_provider column ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'email';

-- ─── handle_new_user trigger ──────────────────────────────────────────────────
-- Fires for both email/password and Google OAuth signups.
-- display_name falls back to email prefix when full_name is not provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    auth_provider
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN NEW.app_metadata->>'provider' = 'google' THEN 'google'
      ELSE 'email'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url    = EXCLUDED.avatar_url,
    auth_provider = EXCLUDED.auth_provider;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── passports: design_state columns ─────────────────────────────────────────
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS design_state            jsonb,
  ADD COLUMN IF NOT EXISTS design_state_updated_at timestamptz;

-- ─── passport_autosaves ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passport_autosaves (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id  uuid         REFERENCES public.passports(id) ON DELETE CASCADE NOT NULL,
  design_state jsonb        NOT NULL,
  saved_at     timestamptz  DEFAULT now()
);

ALTER TABLE public.passport_autosaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autosaves_own" ON public.passport_autosaves
  FOR ALL USING (
    passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS passport_autosaves_passport_saved_at
  ON public.passport_autosaves (passport_id, saved_at DESC);

-- Trim trigger: keep only the 10 most recent autosaves per passport.
CREATE OR REPLACE FUNCTION public.trim_passport_autosaves()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.passport_autosaves
  WHERE passport_id = NEW.passport_id
    AND id NOT IN (
      SELECT id FROM public.passport_autosaves
      WHERE passport_id = NEW.passport_id
      ORDER BY saved_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trim_autosaves_trigger ON public.passport_autosaves;
CREATE TRIGGER trim_autosaves_trigger
  AFTER INSERT ON public.passport_autosaves
  FOR EACH ROW EXECUTE FUNCTION public.trim_passport_autosaves();
