-- 109: impossible-travel anti-spoofing substrate for verify-stamp.
--
-- WHAT: two nullable columns on public.stamps plus one read-only function the
-- verify-stamp edge function calls before it writes a stamp.
--
-- WHY: GPS location is easy to fake on Android with a mock-location app. The
-- current mobile client sends only latitude/longitude (no mock flag, no
-- accuracy), so the server cannot tell a faked fix from a real one. What the
-- server CAN check without a new binary is travel speed: a verified stamp means
-- the collector was within that stop's radius, so the distance between the
-- previous stamped stop and this stop, over the time between the two stamps,
-- is a lower bound on how fast they moved.
--
-- PRIVACY: speed is computed from STOP locations (stops.target_location), never
-- from the collector's coordinates. Stamps still store only the precision-6
-- geohash (verify-stamp). No new personal location data is stored.
--
-- POLICY (enforced in verify-stamp, not here):
--   speed > 1000 km/h and effective distance > 1 km  -> block (no stamp written)
--   speed > 150 km/h                                 -> allow, travel_flagged = true
--   otherwise                                        -> allow, travel_flagged = false
-- Demo stamps and honor-tier stamps skip the check (travel columns stay null).
--
-- Effective distance subtracts both stops' radii, so overlapping stops (a cart
-- inside a pod, both with their own stamp) measure as 0 m and never flag.
-- Only previous stamps with gps_verified = true and is_demo = false count as
-- the anchor, since only those prove where the collector actually was.
--
-- VISIBILITY: no operator surface reads these columns yet. Invariant 7
-- (aggregate only) applies to any future surface: creators may see a COUNT of
-- flagged stamps, never which collector. Collectors can read their own stamp
-- rows under existing RLS; the current client does not read these columns
-- (freeze-safe, no new binary required).
--
-- ROLLBACK:
--   DROP FUNCTION public.stamp_travel_check(uuid, uuid);
--   DROP INDEX IF EXISTS stamps_user_verified_at_idx;
--   ALTER TABLE public.stamps DROP COLUMN travel_flagged, DROP COLUMN travel_speed_kmh;

-- ── 1. Columns ────────────────────────────────────────────────────────────────
-- Nullable tri-state, same pattern as gps_verified (migration 031):
--   travel_speed_kmh null -> no check ran (demo, honor, or no prior anchor stamp)
--   travel_flagged   null -> no check ran
ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS travel_speed_kmh numeric(8,1),
  ADD COLUMN IF NOT EXISTS travel_flagged   boolean;

COMMENT ON COLUMN public.stamps.travel_speed_kmh IS
  'Migration 109. Minimum travel speed from the collector''s previous GPS-verified, non-demo stamp to this stop, using stop locations minus both radii. Null when no check ran.';
COMMENT ON COLUMN public.stamps.travel_flagged IS
  'Migration 109. True when travel_speed_kmh exceeded the flag threshold (150 km/h) in verify-stamp. Null when no check ran. Aggregate-only on operator surfaces (invariant 7).';

-- ── 2. Index for the "most recent anchor stamp" lookup ───────────────────────
CREATE INDEX IF NOT EXISTS stamps_user_verified_at_idx
  ON public.stamps (user_id, verified_at DESC);

-- ── 3. Travel check function ─────────────────────────────────────────────────
-- Returns at most one row: the collector's most recent anchor stamp, the
-- effective distance in meters to p_stop_id, and seconds elapsed since that
-- stamp (server clock on both ends). Returns zero rows when there is no anchor
-- or either stop has no target_location.
CREATE OR REPLACE FUNCTION public.stamp_travel_check(
  p_user_id uuid,
  p_stop_id uuid
)
RETURNS TABLE (
  prev_stamp_id         uuid,
  effective_distance_m  double precision,
  elapsed_seconds       double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT
    st.id,
    GREATEST(
      0,
      ST_Distance(ps.target_location, cs.target_location)
        - COALESCE(ps.verification_radius_meters, ps.radius_meters, 150)
        - COALESCE(cs.verification_radius_meters, cs.radius_meters, 150)
    ),
    EXTRACT(EPOCH FROM (now() - st.verified_at))
  FROM public.stamps st
  JOIN public.stops ps ON ps.id = st.stop_id
  JOIN public.stops cs ON cs.id = p_stop_id
  WHERE st.user_id = p_user_id
    AND st.stop_id <> p_stop_id
    AND st.gps_verified = true
    AND COALESCE(st.is_demo, false) = false
    AND st.verified_at IS NOT NULL
    AND ps.target_location IS NOT NULL
    AND cs.target_location IS NOT NULL
  ORDER BY st.verified_at DESC
  LIMIT 1;
$$;

-- Takes an arbitrary user id, so it must never be callable by clients.
-- verify-stamp calls it with the service role.
REVOKE ALL ON FUNCTION public.stamp_travel_check(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stamp_travel_check(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_travel_check(uuid, uuid) TO service_role;
