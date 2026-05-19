-- Change opacity range to 10–100 and default to 100.
ALTER TABLE public.passport_pages DROP CONSTRAINT IF EXISTS background_opacity_range;
UPDATE public.passport_pages SET background_opacity = 10  WHERE background_opacity < 10;
UPDATE public.passport_pages SET background_opacity = 100 WHERE background_opacity > 100;
ALTER TABLE public.passport_pages
  ADD CONSTRAINT background_opacity_range CHECK (background_opacity >= 10 AND background_opacity <= 100);
ALTER TABLE public.passport_pages ALTER COLUMN background_opacity SET DEFAULT 100;
