-- Migration 007: Cover designer data columns
-- Adds jsonb cover face data and thumbnail storage to passports.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS cover_outside_data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_inside_data  jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_thumbnail    text;
