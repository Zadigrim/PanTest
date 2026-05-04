-- Split single address field into structured components.
ALTER TABLE public.stops
  RENAME COLUMN address TO address_street;

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS address_city  TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip   TEXT;
