-- Migration 030: find_passports_nearby visibility/review guard
--
-- Mobile-tree migration. Replaces the RPC body (last set in 016) to add
-- the publish-visibility + decency-review filter, so nearby discovery
-- fails closed on private and non-approved passports — matching the RLS
-- tightening in web-tree migration 091.
--
-- DEPLOY ORDER: runs AFTER web-tree 091 (which adds passports.visibility
-- and passports.review_status). If 091 hasn't landed when this runs, the
-- function body errors at creation time because those columns don't exist
-- yet — same deploy-order discipline as 016 vs web-tree 069.
--
-- The diff vs 016 is two new lines in the nearby_stops CTE WHERE clause:
--   AND p.visibility = 'public'
--   AND p.review_status = 'approved'
-- Signature, return type, stateless posture, GRANTs, COMMENT unchanged.

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
      -- M2 leak guard (migration 069 / 016).
      AND p.distribution_only = false
      -- Publish-visibility + decency-review guard (web-tree 091).
      -- Private and non-approved passports never appear in nearby
      -- discovery; holders reach them via their library / invite link.
      AND p.visibility = 'public'
      AND p.review_status = 'approved'
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
    r.nearest_m       AS distance_m,
    r.stops_in_radius
  FROM ranked r
  JOIN public.passports p ON p.id = r.passport_id
  ORDER BY r.nearest_m ASC
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer) IS
  'Published, listable (distribution_only=false), public + review-approved passports with >=1 location-bearing stop within p_radius_km of (p_lat,p_lng), ranked by nearest-stop distance. Stateless: coordinates are not persisted.';

GRANT EXECUTE ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer)
  TO anon, authenticated;
