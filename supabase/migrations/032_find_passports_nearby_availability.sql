-- Migration 032: find_passports_nearby — availability-window awareness
--
-- Extends find_passports_nearby (migration 030) for the passport availability
-- window (okujiKobo migration 110). Two changes vs 030:
--   1. HIDE ENDED passports from nearby discovery:
--        AND (p.expires_at IS NULL OR p.expires_at > now())
--      Upcoming passports (now() < effective_at) are NOT hidden — they appear
--      with an "Opens <date>" badge (the client reads the new effective_at
--      column), matching browse behaviour. Ended passports drop out entirely;
--      holders still see them in their own collection (collector_passports is
--      unfiltered).
--   2. Return effective_at so the client can render the "Opens" badge without a
--      second query.
--
-- DEPLOY ORDER: runs AFTER okujiKobo migration 110 (which adds
-- passports.effective_at / expires_at). If 110 hasn't landed, p.expires_at /
-- p.effective_at won't exist and this CREATE OR REPLACE will error — apply 110
-- first.
--
-- Everything else is byte-identical to 030 (visibility/review/distribution
-- guards, distance ranking, location-stop filter, STABLE PARALLEL SAFE).
--
-- DROP first: adding effective_at changes the RETURNS TABLE row type, which
-- CREATE OR REPLACE cannot do ("cannot change return type of existing
-- function"). The function is only invoked via client RPC, so dropping +
-- recreating has no DB-level dependents.

DROP FUNCTION IF EXISTS public.find_passports_nearby(double precision, double precision, double precision, integer);

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
  effective_at     timestamptz,
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
      AND p.distribution_only = false
      AND p.visibility = 'public'
      AND p.review_status = 'approved'
      -- Availability window (migration 110): hide ENDED passports from nearby
      -- discovery. Upcoming ones stay (client shows an "Opens" badge).
      AND (p.expires_at IS NULL OR p.expires_at > now())
      AND ST_DWithin(
        s.target_location,
        (SELECT pt FROM user_point),
        GREATEST(p_radius_km, 0) * 1000.0
      )
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
    p.effective_at,
    r.nearest_m       AS distance_m,
    r.stops_in_radius
  FROM ranked r
  JOIN public.passports p ON p.id = r.passport_id
  ORDER BY r.nearest_m ASC
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer) IS
  'Published, listable, public + review-approved, NON-ENDED passports with >=1 location-bearing stop within p_radius_km of (p_lat,p_lng), ranked by nearest-stop distance. Returns effective_at for an "Opens" badge on upcoming passports. Stateless: coordinates are not persisted (migration 032).';
