-- Bridge the web designer's lat/lng with the mobile schema's target_location.
--
-- WHY: the okujiKobo web designer's stop inspector writes plain lat/lng to
-- the stops table. Production runs the mobile schema, which has only
-- target_location (geography(Point,4326)) and no lat/lng columns. The result
-- is that PostgREST silently rejected the lat/lng writes (unknown columns),
-- target_location stayed NULL, and verify-stamp's GPS branch was skipped —
-- so any web-designed stop above tier 5 (honor) could not be stamped on
-- mobile. This migration adds the lat/lng columns and a BEFORE INSERT/UPDATE
-- trigger that keeps target_location in sync with them. verify-stamp is
-- unchanged: it continues to read target_location, which is now populated.
--
-- The trigger is bidirectional on INSERT only (so a stop created with just
-- target_location backfills lat/lng for the web designer's UI). On UPDATE the
-- canonical direction is lat/lng → target_location.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE OR REPLACE FUNCTION public.sync_stop_target_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Primary: lat/lng → target_location. Both must be present to derive a point.
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.target_location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSIF NEW.lat IS NULL AND NEW.lng IS NULL THEN
    -- Both cleared → clear target_location too. A single-side NULL is treated
    -- as in-flight user input and leaves target_location alone.
    NEW.target_location := NULL;
  END IF;

  -- Reverse on INSERT only: if the caller wrote target_location but not
  -- lat/lng (e.g., mobile editor passing PostGIS WKT), backfill the scalars
  -- so the web designer's UI shows the right values when the row loads.
  IF TG_OP = 'INSERT'
     AND NEW.target_location IS NOT NULL
     AND (NEW.lat IS NULL OR NEW.lng IS NULL)
  THEN
    NEW.lng := ST_X(NEW.target_location::geometry);
    NEW.lat := ST_Y(NEW.target_location::geometry);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stops_sync_target_location ON public.stops;
CREATE TRIGGER stops_sync_target_location
BEFORE INSERT OR UPDATE ON public.stops
FOR EACH ROW
EXECUTE FUNCTION public.sync_stop_target_location();

-- Backfill: for existing stops that already have target_location set (via the
-- mobile editor or direct SQL), populate lat/lng so the web designer's UI can
-- display them. Stops with no target_location stay NULL on both sides.
UPDATE public.stops
SET lat = ST_Y(target_location::geometry),
    lng = ST_X(target_location::geometry)
WHERE target_location IS NOT NULL
  AND (lat IS NULL OR lng IS NULL);
