-- 029_moichido_ensure_punch_stop.sql
--
-- M4.4 merchant terminal support. A moichido punch card is a
-- consumable passport whose design carries location-free punch_slots
-- (migration 028) — purely the card-face visual. The M3 punch loop,
-- however, operates on a stops row (issue_stop_qr_token takes a
-- stop_id; consume_stop_qr_token_and_punch resolves token → stop →
-- page → passport and writes punches.stop_id). A freshly-created
-- moichido card has NO stops row, so the terminal has nothing to
-- issue a punch against.
--
-- This function find-or-creates the single canonical "punch stop" for
-- a card — the counter punch-point. It exists because the terminal
-- operator is gated on can_verify / can_distribute_prizes, NOT
-- can_design, so the stops_creator RLS policy (creator OR can_design)
-- would block a non-creator operator from inserting the stop directly.
-- SECURITY DEFINER lets it create the stop after applying the SAME
-- authorization gate issue_stop_qr_token uses.
--
-- It writes NO punch/token logic — issue_stop_qr_token (021) remains
-- the single source for that. This only provisions the stop.
--
-- The stop is experience_type='experience' → the migration-046 trigger
-- forces method='honor' and verification_tier=5, and target_location
-- stays NULL, so consume_stop_qr_token_and_punch skips GPS: the
-- vendor-presented one-off token IS the proof (matching that
-- function's documented honor/witnessed handling).
--
-- Additive. No schema change beyond this new function. Idempotent:
-- a card that already has a stop returns it; the page row is locked
-- to serialise concurrent first-issues so a race can't create two.

CREATE OR REPLACE FUNCTION public.ensure_moichido_punch_stop(
  p_passport_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_creator    uuid;
  v_proprietor uuid;
  v_cred       text;
  v_authorized boolean := false;
  v_can_verify boolean := false;
  v_can_dist   boolean := false;
  v_page_id    uuid;
  v_stop_id    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT creator_id, proprietor_id, credential_type
    INTO v_creator, v_proprietor, v_cred
    FROM public.passports
   WHERE id = p_passport_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_cred IS DISTINCT FROM 'consumable' THEN
    RAISE EXCEPTION 'not a consumable card' USING ERRCODE = '22023';
  END IF;

  -- Same authorization gate as issue_stop_qr_token (migration 021):
  -- platform admin, creator, or employee with can_verify or
  -- can_distribute_prizes at the owning institution.
  IF public.is_platform_admin() THEN
    v_authorized := true;
  ELSIF v_creator = v_caller THEN
    v_authorized := true;
  ELSIF v_proprietor IS NOT NULL THEN
    SELECT COALESCE(ea.can_verify, false), COALESCE(ea.can_distribute_prizes, false)
      INTO v_can_verify, v_can_dist
      FROM public.employee_authorizations ea
     WHERE ea.user_id = v_caller
       AND ea.institution_id = v_proprietor;
    v_authorized := v_can_verify OR v_can_dist;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized for this card' USING ERRCODE = '42501';
  END IF;

  -- First open page of the card.
  SELECT id INTO v_page_id
    FROM public.passport_pages
   WHERE passport_id = p_passport_id
     AND closed_at IS NULL
   ORDER BY page_order ASC
   LIMIT 1;

  IF v_page_id IS NULL THEN
    RAISE EXCEPTION 'card has no page' USING ERRCODE = '22023';
  END IF;

  -- Serialise concurrent first-issues on this card.
  PERFORM 1 FROM public.passport_pages WHERE id = v_page_id FOR UPDATE;

  -- Find-or-create. A moichido card has no other stops, so the
  -- lowest-ordered stop on the page IS the punch stop.
  SELECT id INTO v_stop_id
    FROM public.stops
   WHERE page_id = v_page_id
   ORDER BY stop_order ASC
   LIMIT 1;

  IF v_stop_id IS NULL THEN
    INSERT INTO public.stops
      (page_id, stop_order, name, experience_type, box_x, box_y)
    VALUES
      (v_page_id, 0, 'Punch', 'experience', 40, 40)
    RETURNING id INTO v_stop_id;
    -- experience_type='experience' → trigger sets method='honor',
    -- verification_tier=5; target_location NULL → consume skips GPS.
  END IF;

  RETURN v_stop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_moichido_punch_stop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_moichido_punch_stop(uuid) TO authenticated;
