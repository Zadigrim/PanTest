-- Migration 018: add 'grid' to passport_pages background_type CHECK constraint
ALTER TABLE public.passport_pages DROP CONSTRAINT IF EXISTS passport_pages_background_type_check;
ALTER TABLE public.passport_pages
  ADD CONSTRAINT passport_pages_background_type_check
  CHECK (background_type IN ('guilloche', 'landscape', 'none', 'custom', 'grid'));
