-- Extend background_opacity upper bound from 12 to 100 to allow full-opacity backgrounds.
ALTER TABLE public.passport_pages DROP CONSTRAINT IF EXISTS background_opacity_range;
UPDATE public.passport_pages SET background_opacity = 100 WHERE background_opacity > 100;
ALTER TABLE public.passport_pages
  ADD CONSTRAINT background_opacity_range CHECK (background_opacity >= 8 AND background_opacity <= 100);
