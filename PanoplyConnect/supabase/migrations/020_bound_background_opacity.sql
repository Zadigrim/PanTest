-- Migration 020: bound background_opacity to 8–12, default 10

-- Step 1: clamp any existing out-of-range values
UPDATE public.passport_pages SET background_opacity = 8  WHERE background_opacity < 8;
UPDATE public.passport_pages SET background_opacity = 12 WHERE background_opacity > 12;

-- Step 2: add CHECK constraint
ALTER TABLE public.passport_pages
  ADD CONSTRAINT background_opacity_range
  CHECK (background_opacity >= 8 AND background_opacity <= 12);

-- Step 3: change column default
ALTER TABLE public.passport_pages
  ALTER COLUMN background_opacity SET DEFAULT 10;
