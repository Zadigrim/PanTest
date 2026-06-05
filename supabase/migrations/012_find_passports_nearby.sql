-- 012_find_passports_nearby.sql
--
-- "Nearby" passport discovery RPC for the collector mobile app.
--
-- Given an ephemeral (lat, lng), returns published passports that
-- have at least one location-bearing stop within p_radius_km of the
-- point — ranked by distance to the nearest stop. Honor /
-- Event-Activity stops (experience_type='experience' or tier=5)
-- carry no location and are simply ignored; a passport can still
-- qualify via its physical stops.
--
-- PRIVACY: this RPC is stateless. The caller's coordinates enter
-- as parameters, are used to construct the search point, and are
-- discarded when the function returns. NO rows are written. The
-- mobile client deletes the coords from memory after the call (see
-- lib/nearby.ts). No new location columns are added anywhere.
--
-- INDEX: relies on the existing GIST index `stops_location_idx`
-- on stops(target_location), created in migration 001. No new
-- index needed; ST_DWithin uses GIST automatically.
--
-- SECURITY: SECURITY INVOKER (the default) — respects RLS. Since
-- published passports are publicly readable, this works for anon
-- callers too; granted to both anon and authenticated.
--
-- READ-ONLY: this is a discovery surface; nothing about verify-
-- stamp, radius semantics, or any verification path is changed.

CREATE OR REPLACE FUNCTION public.find_passports_nearby(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision DEFAULT 25,
  p_limit      integer          DEFAULT 20
)
RETURNS TABLE(
  passport_id      uuid,
  title            text,
  cover_emblem     text,
  cover_bg_color   text,
  cover_thumbnail  text,
  is_free          boolean,
  price_cents      integer,
  creator_id       uuid,
  proprietor_id    uuid,
  distance_m       double precision,
  stops_in_radius  integer
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH user_point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS pt
  ),
  nearby_stops AS (
    SELECT
      pp.passport_id,
      ST_Distance(s.target_location, (SELECT pt FROM user_point)) AS dist_m
    FROM public.stops s
    JOIN public.passport_pages pp ON pp.id = s.page_id
    JOIN public.passports     p  ON p.id  = pp.passport_id
    WHERE s.target_location IS NOT NULL
      AND p.is_published = true
      AND ST_DWithin(
        s.target_location,
        (SELECT pt FROM user_point),
        GREATEST(p_radius_km, 0) * 1000.0
      )
      -- Honor / Event-Activity stops have no location and shouldn't
      -- count toward "nearby" even if a target_location somehow
      -- crept in. Fall back to verification_tier for any pre-046
      -- rows whose canonical experience_type never got backfilled
      -- (tier 5 = honor / experience).
      AND (
        s.experience_type = 'location'
        OR (s.experience_type IS NULL AND COALESCE(s.verification_tier, 0) <> 5)
      )
  ),
  ranked AS (
    SELECT
      passport_id,
      MIN(dist_m)              AS nearest_m,
      COUNT(*)::integer        AS stops_in_radius
    FROM nearby_stops
    GROUP BY passport_id
  )
  SELECT
    p.id              AS passport_id,
    p.title,
    p.cover_emblem,
    p.cover_bg_color,
    p.cover_thumbnail,
    p.is_free,
    p.price_cents,
    p.creator_id,
    p.proprietor_id,
    r.nearest_m       AS distance_m,
    r.stops_in_radius
  FROM ranked r
  JOIN public.passports p ON p.id = r.passport_id
  ORDER BY r.nearest_m ASC
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer) IS
  'Published passports with ≥1 location-bearing stop within p_radius_km of (p_lat,p_lng), ranked by nearest-stop distance. Stateless: coordinates are not persisted anywhere.';

GRANT EXECUTE ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer)
  TO anon, authenticated;
