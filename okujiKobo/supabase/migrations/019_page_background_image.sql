-- Migration 019: add background_image_url to passport_pages
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS background_image_url text;
