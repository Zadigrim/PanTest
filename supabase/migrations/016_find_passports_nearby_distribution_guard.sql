-- Migration 016: find_passports_nearby leak guard (M2)
--
-- Mobile-tree migration. Replaces the RPC body shipped in 012 to
-- add the distribution_only=false filter. CREATE OR REPLACE
-- FUNCTION — additive, no schema change, no semantic change for
-- any persistent passport (their distribution_only column,
-- added by web-tree migration 069, defaults to false).
--
-- DEPLOY ORDER: runs AFTER web-tree 069 (which adds the
-- distribution_only column on passports). If 069 hasn't
-- landed when this migration runs, the function body errors at
-- creation time because p.distribution_only doesn't exist —
-- so the deploy-order discipline matters.
--
-- Every other field of the function — signature, return type,
-- privacy posture (stateless), GRANTs, COMMENT — is unchanged.
-- The diff is one new line:
--   AND p.distribution_only = false
-- inside the WHERE clause of the nearby_stops CTE.

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
      -- M2 leak guard (migration 069 adds the column).
      -- Consumable distribution-only passports never appear in
      -- nearby discovery; holders reach them via direct link or
      -- their library, not via Explore.
      AND p.distribution_only = false
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
  'Published, listable (distribution_only=false) passports with >=1 location-bearing stop within p_radius_km of (p_lat,p_lng), ranked by nearest-stop distance. Stateless: coordinates are not persisted anywhere.';

-- Grants unchanged from 012.
GRANT EXECUTE ON FUNCTION public.find_passports_nearby(double precision, double precision, double precision, integer)
  TO anon, authenticated;
