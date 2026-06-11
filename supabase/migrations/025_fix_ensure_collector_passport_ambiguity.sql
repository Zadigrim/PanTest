-- Migration 025: fix ambiguous "id" in ensure_collector_passport
--
-- The 021 body declares RETURNS TABLE(id uuid, ...), which makes `id` a
-- PL/pgSQL output variable in scope. The new-acquisition path then runs
--
--   SELECT expiry_duration_days, credential_type, consumable_target_count
--     FROM public.passports
--    WHERE id = p_passport_id;        -- ambiguous: out-var vs column
--
-- which raises 42702 'column reference "id" is ambiguous' on EVERY
-- first acquisition (the idempotent existing-row fast-path never
-- references id, so re-calls for already-held passports worked — which
-- is why this hid until a fresh account acquired its first passport).
-- Both the mobile app's acquisition flow and the reviewer seeding go
-- through this RPC, so first acquisitions were broken platform-wide.
--
-- Fix: alias the table and qualify the column (p.id). Body otherwise
-- byte-identical to 021. Same signature/grants — callers unchanged.
--
-- ROLLBACK: re-create from 021 (restores the bug; don't).

CREATE OR REPLACE FUNCTION public.ensure_collector_passport(
  p_user_id     uuid,
  p_passport_id uuid
)
RETURNS TABLE(
  id          uuid,
  copy_number integer,
  expires_at  timestamptz,
  acquired_at timestamptz,
  is_new      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_existing       public.collector_passports%ROWTYPE;
  v_allocated      integer;
  v_duration       integer;
  v_expires_at     timestamptz;
  v_now            timestamptz := now();
  v_new            public.collector_passports%ROWTYPE;
  v_cred_type      text;
  v_target_count   integer;
BEGIN
  -- Idempotent fast-path: existing row.
  SELECT * INTO v_existing
    FROM public.collector_passports
   WHERE user_id = p_user_id
     AND passport_id = p_passport_id;

  IF FOUND THEN
    id          := v_existing.id;
    copy_number := v_existing.copy_number;
    expires_at  := v_existing.expires_at;
    acquired_at := v_existing.acquired_at;
    is_new      := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- New acquisition path.
  v_allocated := public.allocate_copy_number(p_passport_id);

  SELECT p.expiry_duration_days, p.credential_type, p.consumable_target_count
    INTO v_duration, v_cred_type, v_target_count
    FROM public.passports p
   WHERE p.id = p_passport_id;

  IF v_duration IS NOT NULL THEN
    v_expires_at := v_now + make_interval(days => v_duration);
  ELSE
    v_expires_at := NULL;
  END IF;

  INSERT INTO public.collector_passports
    (user_id, passport_id, acquired_at, copy_number, expires_at)
  VALUES
    (p_user_id, p_passport_id, v_now, v_allocated, v_expires_at)
  RETURNING * INTO v_new;

  -- Consumable side-effect: seed the first card_instance. Refuses
  -- if the design doesn't carry a target count — that field is
  -- the M4 designer's commitment to a card length, not something
  -- we should silently default away.
  IF v_cred_type = 'consumable' THEN
    IF v_target_count IS NULL THEN
      RAISE EXCEPTION 'consumable passport missing consumable_target_count'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.card_instances
      (collector_passport_id, sequence, target_count, reissue_on_completion)
    VALUES
      (v_new.id, 1, v_target_count, true);
  END IF;

  id          := v_new.id;
  copy_number := v_new.copy_number;
  expires_at  := v_new.expires_at;
  acquired_at := v_new.acquired_at;
  is_new      := true;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_collector_passport(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_collector_passport(uuid, uuid) TO authenticated;
