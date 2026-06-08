-- Migration 021: M3 consumable function surface
--
-- Mobile-tree migration. Adds the per-card columns + the four
-- SECURITY DEFINER functions that implement the consumable
-- credential loop:
--
--   issue_stop_qr_token                 (vendor-presented one-off QR)
--   consume_stop_qr_token_and_punch     (collector consumes + punches)
--   redeem_completion                   (employee redeems at terminal,
--                                        consumable side-effect folded in)
--   generate_completion_token_code      (helper used by the above)
--
-- ensure_collector_passport (migration 019) is REPLACED to seed the
-- first card_instance when credential_type='consumable'.
--
-- VERIFY-STAMP IS UNTOUCHED. The persistent okuji stamping path
-- (stamps table, UNIQUE(user_id, stop_id), client-side INSERT after
-- verify-stamp returns verified) is byte-identical pre/post this
-- migration. The consumable path lives entirely in these new
-- functions and never crosses the persistent surface.
--
-- DEPLOY ORDER: web-tree 071 (passports.consumable_target_count)
-- must run FIRST. ensure_collector_passport reads that column when
-- seeding a consumable holder's first card_instance.
--
-- AUTH MODEL — function-level
--   - is_platform_admin (the canonical platform-admin gate per
--     CLAUDE.md #4) bypasses every check.
--   - issue_stop_qr_token: creator OR can_verify OR
--     can_distribute_prizes at the stop's owning institution.
--   - consume_stop_qr_token_and_punch: the caller must own the
--     passport (collector_passports row) and the passport must be
--     credential_type='consumable'.
--   - redeem_completion: can_verify required for both actions;
--     can_distribute_prizes additionally required for
--     action='distributed' (closes the DEC-08 logic — extras are
--     folded into can_distribute_prizes, so the distribution
--     action itself should respect the same gate).
--
-- AUTH MODEL — RLS on touched tables
--   Unchanged from M2. RLS continues to use is_admin (mobile-tree
--   convention). Function-level auth uses is_platform_admin per
--   CLAUDE.md. These are different surfaces and the inconsistency
--   is intentional.
--
-- PRESERVATION INVARIANT
--   consumed_at is state, never DELETE. The functions only ever
--   SET consumed_at; no DELETE on punches, card_instances,
--   collector_passports, or stop_qr_tokens. CLAUDE.md #1 holds.
--
-- COMPLETION LIFECYCLE
--   On the punch that fills the card (punch_sequence reaches
--   card_instances.target_count): the active card_instance is
--   marked consumed_at AND a completion_token is generated.
--   Reissue does NOT happen at punch time — the partial unique
--   index on (collector_passport_id) WHERE consumed_at IS NULL
--   means the holder has NO active card between fill and
--   redemption (no further punches accepted; "card full, please
--   redeem"). Reissue happens at redemption (redeem_completion
--   issues the next instance if reissue_on_completion=true) so
--   the "earn → redeem → fresh card" arc lands cleanly and the
--   spec's "card instance moves to consumed_at" at redemption
--   reads naturally.
--
-- PREPAID VARIANT
--   reissue_on_completion=false on a card means redemption marks
--   the token redeemed but does NOT issue a next instance — the
--   prepaid card's life ends with that single redemption.
--
-- ROLLBACK
--   DROP the four new functions; restore ensure_collector_passport
--   to its 019 body; ALTER TABLE card_instances DROP COLUMN
--   target_count, reissue_on_completion. No data loss path because
--   the functions are the only writers of consumable state and no
--   non-test consumable rows exist when this lands.

-- ─── card_instances columns ─────────────────────────────────────
--
-- target_count: per-card punch target. Sequential moichido cards
-- ship with the passport's design-time consumable_target_count
-- value (web-tree 071); the prepaid variant issues arbitrary
-- per-card values without touching the design column.
--
-- reissue_on_completion: whether redemption issues the next
-- instance. true for the moichido sequential mode (the default;
-- "punch ten, redeem, punch ten more, redeem, ..."); false for
-- the prepaid mode ("paid for one card, redeem once, done").
ALTER TABLE public.card_instances
  ADD COLUMN IF NOT EXISTS target_count integer NULL;

UPDATE public.card_instances SET target_count = 10 WHERE target_count IS NULL;

ALTER TABLE public.card_instances
  ALTER COLUMN target_count SET NOT NULL;

ALTER TABLE public.card_instances
  DROP CONSTRAINT IF EXISTS card_instances_target_count_positive;
ALTER TABLE public.card_instances
  ADD CONSTRAINT card_instances_target_count_positive
  CHECK (target_count > 0);

ALTER TABLE public.card_instances
  ADD COLUMN IF NOT EXISTS reissue_on_completion boolean NOT NULL DEFAULT true;

-- ─── Helper: generate_completion_token_code ─────────────────────
-- PL/pgSQL, NOT SECURITY DEFINER (called only from SECDEF
-- functions in this file). Replicates the entropy + per-institution
-- prefix logic from the existing generate-token Edge function so
-- both consumable-completion and persistent-completion tokens
-- share a format.
CREATE OR REPLACE FUNCTION public.generate_completion_token_code(
  p_passport_id uuid
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_prefix     text := 'OKJ';
  v_proprietor uuid;
  v_chars      text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_part1      text := '';
  v_part2      text := '';
  v_inst_pref  text;
  v_i          integer;
BEGIN
  SELECT proprietor_id INTO v_proprietor FROM public.passports WHERE id = p_passport_id;
  IF v_proprietor IS NOT NULL THEN
    SELECT token_prefix INTO v_inst_pref FROM public.institutions WHERE id = v_proprietor;
    IF v_inst_pref IS NOT NULL AND v_inst_pref ~ '^[A-Z0-9]{1,6}$' THEN
      v_prefix := v_inst_pref;
    END IF;
  END IF;

  FOR v_i IN 1..4 LOOP
    v_part1 := v_part1 || substr(v_chars, 1 + floor(random() * 32)::int, 1);
  END LOOP;
  FOR v_i IN 1..2 LOOP
    v_part2 := v_part2 || substr(v_chars, 1 + floor(random() * 32)::int, 1);
  END LOOP;

  RETURN v_prefix || '-' || v_part1 || '-' || v_part2;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_completion_token_code(uuid) FROM PUBLIC;

-- ─── ensure_collector_passport (REPLACE) ────────────────────────
-- Extended from migration 019 to seed the first card_instance
-- when the acquired passport is credential_type='consumable'.
-- Signature unchanged so existing callers (api/acquire,
-- api/webhook/stripe, mobile hooks/usePassport.ts) bind
-- transparently.
--
-- Behavior delta:
--   * Persistent passports: identical to 019.
--   * Consumable passports + is_new=true:
--       additionally INSERT card_instances (sequence=1,
--       target_count=passports.consumable_target_count,
--       reissue_on_completion=true).
--       Refuses (raises) when consumable_target_count IS NULL —
--       the design-time field MUST be set on a consumable
--       passport before holders acquire it.
--   * Consumable passports + is_new=false (idempotent re-call):
--       does NOT seed; the prior call did.
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

  SELECT expiry_duration_days, credential_type, consumable_target_count
    INTO v_duration, v_cred_type, v_target_count
    FROM public.passports
   WHERE id = p_passport_id;

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

-- ─── FUNCTION 1: issue_stop_qr_token ────────────────────────────
-- Vendor/employee-initiated. Generates a short-lived single-use
-- token for one punch. Returns the token text for one-time display
-- (the table has admin-only RLS — only this function writes it,
-- only this function's return value carries it back out).
CREATE OR REPLACE FUNCTION public.issue_stop_qr_token(
  p_stop_id      uuid,
  p_ttl_seconds  integer DEFAULT 300
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_creator      uuid;
  v_proprietor   uuid;
  v_token        text;
  v_authorized   boolean := false;
  v_can_verify   boolean := false;
  v_can_dist     boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_ttl_seconds IS NULL OR p_ttl_seconds <= 0 OR p_ttl_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid TTL (must be 1..86400 seconds)' USING ERRCODE = '22023';
  END IF;

  -- Resolve the stop's passport and owning institution.
  SELECT pa.creator_id, pa.proprietor_id
    INTO v_creator, v_proprietor
    FROM public.stops s
    JOIN public.passport_pages pp ON pp.id = s.page_id
    JOIN public.passports      pa ON pa.id = pp.passport_id
   WHERE s.id = p_stop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stop not found' USING ERRCODE = 'P0002';
  END IF;

  -- Authorize: platform admin, creator, or employee with
  -- can_verify or can_distribute_prizes at the proprietor.
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
    RAISE EXCEPTION 'not authorized to issue tokens for this stop' USING ERRCODE = '42501';
  END IF;

  -- 16 random bytes → base64url, prefixed so vendor-presented tokens
  -- are distinguishable at-a-glance from stable per-stop qr_code_id
  -- values (which start with OKUJI-...).
  v_token := 'M3-' || translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_');

  INSERT INTO public.stop_qr_tokens
    (stop_id, token, single_use, expires_at, created_by)
  VALUES
    (p_stop_id, v_token, true, now() + make_interval(secs => p_ttl_seconds), v_caller);

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_stop_qr_token(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_stop_qr_token(uuid, integer) TO authenticated;

-- ─── FUNCTION 2: consume_stop_qr_token_and_punch ────────────────
-- Atomic: validate the token, resolve the caller's active card,
-- punch, and (if the punch fills the card) mark consumed +
-- generate a completion_token. Reissue is deferred to
-- redeem_completion per the lifecycle described in the file
-- header.
CREATE OR REPLACE FUNCTION public.consume_stop_qr_token_and_punch(
  p_token          text,
  p_lat            double precision DEFAULT NULL,
  p_lng            double precision DEFAULT NULL,
  p_stop_opened_at timestamptz      DEFAULT now()
)
RETURNS public.punches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_tok           public.stop_qr_tokens%ROWTYPE;
  v_stop          public.stops%ROWTYPE;
  v_page_id       uuid;
  v_passport_id   uuid;
  v_cred_type     text;
  v_cp            public.collector_passports%ROWTYPE;
  v_instance      public.card_instances%ROWTYPE;
  v_punch_seq     integer;
  v_gps_ok        boolean;
  v_inserted      public.punches%ROWTYPE;
  v_token_code    text;
  v_locwl         uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Lock the token row so concurrent consumes serialise.
  SELECT * INTO v_tok
    FROM public.stop_qr_tokens
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid token' USING ERRCODE = '22023';
  END IF;

  IF v_tok.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'token already consumed' USING ERRCODE = '22023';
  END IF;

  IF v_tok.expires_at IS NOT NULL AND v_tok.expires_at < now() THEN
    RAISE EXCEPTION 'token expired' USING ERRCODE = '22023';
  END IF;

  -- Resolve stop + passport chain.
  SELECT * INTO v_stop FROM public.stops WHERE id = v_tok.stop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stop not found' USING ERRCODE = 'P0002';
  END IF;
  v_page_id := v_stop.page_id;

  SELECT pp.passport_id INTO v_passport_id
    FROM public.passport_pages pp
   WHERE pp.id = v_page_id;

  SELECT credential_type INTO v_cred_type
    FROM public.passports WHERE id = v_passport_id;

  IF v_cred_type IS DISTINCT FROM 'consumable' THEN
    RAISE EXCEPTION 'not a consumable passport' USING ERRCODE = '22023';
  END IF;

  -- Caller must own this passport.
  SELECT * INTO v_cp
    FROM public.collector_passports
   WHERE user_id = v_caller AND passport_id = v_passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller does not own this passport' USING ERRCODE = '42501';
  END IF;

  -- Caller must have an active (non-consumed) card_instance.
  SELECT * INTO v_instance
    FROM public.card_instances
   WHERE collector_passport_id = v_cp.id
     AND consumed_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active card instance (card may be full and awaiting redemption)'
      USING ERRCODE = '22023';
  END IF;

  -- GPS check: only when the stop has a target_location AND its
  -- verification_tier indicates GPS (T1, T2, T3 — matches
  -- verify-stamp's tier model). Honor (T5) and witnessed (T4)
  -- stops skip GPS — the vendor-presented token IS the proof.
  IF v_stop.target_location IS NOT NULL
     AND v_stop.verification_tier IN (1, 2, 3)
  THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'GPS coordinates required for this stop' USING ERRCODE = '22023';
    END IF;
    SELECT public.check_gps_within_radius(
      p_lat, p_lng, v_stop.id,
      COALESCE(v_stop.verification_radius_meters, v_stop.radius_meters, 150)
    ) INTO v_gps_ok;
    IF NOT COALESCE(v_gps_ok, false) THEN
      RAISE EXCEPTION 'GPS out of range' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Next sequence within the active instance.
  SELECT COALESCE(MAX(punch_sequence), 0) + 1
    INTO v_punch_seq
    FROM public.punches
   WHERE card_instance_id = v_instance.id;

  -- Mark token consumed FIRST so a duplicate attempt on the
  -- same token sees consumed_at populated before the punch lands.
  UPDATE public.stop_qr_tokens
     SET consumed_at = now(), consumed_by = v_caller
   WHERE id = v_tok.id;

  -- INSERT the punch. The UNIQUE(card_instance_id, punch_sequence)
  -- on punches catches any concurrent-consume race that slipped
  -- past the row lock (defensive).
  INSERT INTO public.punches
    (card_instance_id, punch_sequence, user_id, stop_id, punched_at, verification_method)
  VALUES
    (v_instance.id, v_punch_seq, v_caller, v_stop.id, now(), 'one_off_token')
  RETURNING * INTO v_inserted;

  -- Completion: card fills on the punch that hits target_count.
  -- Mark the instance consumed (no more punches accepted via the
  -- partial-unique-on-active index) and generate the completion
  -- token. Reissue happens at redeem_completion, not here.
  IF v_punch_seq >= v_instance.target_count THEN
    UPDATE public.card_instances SET consumed_at = now() WHERE id = v_instance.id;

    v_token_code := public.generate_completion_token_code(v_passport_id);
    SELECT prize_redeemable_location_ids INTO v_locwl
      FROM public.passport_pages WHERE id = v_page_id;

    INSERT INTO public.completion_tokens
      (user_id, passport_id, page_id, token_code, expires_at, location_whitelist)
    VALUES
      (v_caller, v_passport_id, v_page_id, v_token_code,
       now() + interval '30 days', v_locwl);
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_stop_qr_token_and_punch(text, double precision, double precision, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_stop_qr_token_and_punch(text, double precision, double precision, timestamptz) TO authenticated;

-- ─── FUNCTION 3: redeem_completion ──────────────────────────────
-- Single redemption mechanism for BOTH persistent and consumable
-- credentials. Closes KI-02 — McMenamins prize + moichido card
-- completion share one terminal flow + one audit row.
--
-- Persistent passport: marks completion_token redeemed; no card-
-- instance side-effect.
-- Consumable passport + reissue_on_completion=true on the holder's
--   most recent (consumed) instance: additionally issues the next
--   sequence card_instance.
-- Consumable passport + reissue_on_completion=false (prepaid):
--   no next instance issued; the card's life ends here.
CREATE OR REPLACE FUNCTION public.redeem_completion(
  p_token_code   text,
  p_action       text,
  p_note         text    DEFAULT NULL,
  p_extra_cents  integer DEFAULT NULL
)
RETURNS public.completion_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller            uuid := auth.uid();
  v_tok               public.completion_tokens%ROWTYPE;
  v_passport          public.passports%ROWTYPE;
  v_authz             public.employee_authorizations%ROWTYPE;
  v_is_admin          boolean := false;
  v_now               timestamptz := now();
  v_prize_note        text;
  v_extra_str         text;
  v_last_instance     public.card_instances%ROWTYPE;
  v_updated           public.completion_tokens%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('distributed', 'pending') THEN
    RAISE EXCEPTION 'invalid action (must be distributed or pending)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tok
    FROM public.completion_tokens
   WHERE token_code = p_token_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tok.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'token already redeemed' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_passport FROM public.passports WHERE id = v_tok.passport_id;
  IF v_passport.proprietor_id IS NULL THEN
    RAISE EXCEPTION 'token has no institutional owner' USING ERRCODE = '22023';
  END IF;

  -- Auth: platform admin bypasses; otherwise can_verify required;
  -- can_distribute_prizes additionally required for 'distributed'.
  v_is_admin := public.is_platform_admin();
  IF NOT v_is_admin THEN
    SELECT * INTO v_authz
      FROM public.employee_authorizations
     WHERE user_id = v_caller
       AND institution_id = v_passport.proprietor_id;
    IF NOT FOUND OR NOT COALESCE(v_authz.can_verify, false) THEN
      RAISE EXCEPTION 'not authorized to redeem tokens for this institution' USING ERRCODE = '42501';
    END IF;
    IF p_action = 'distributed' AND NOT COALESCE(v_authz.can_distribute_prizes, false) THEN
      RAISE EXCEPTION 'can_distribute_prizes required for distributed action' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Build prize_note (matches the buildPrizeNote shape from
  -- okujiKobo/app/api/token/redeem/route.ts so consumers don't see
  -- a format shift when the route migrates to call this function).
  IF p_extra_cents IS NOT NULL AND p_extra_cents > 0 THEN
    v_extra_str := 'Extra gift card: $' || to_char(p_extra_cents::numeric / 100, 'FM999990.00');
    IF p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN
      v_prize_note := p_note || ' | ' || v_extra_str;
    ELSE
      v_prize_note := v_extra_str;
    END IF;
  ELSIF p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN
    v_prize_note := p_note;
  ELSE
    v_prize_note := NULL;
  END IF;

  IF p_action = 'distributed' THEN
    UPDATE public.completion_tokens
       SET prize_distributed       = true,
           redeemed_at             = v_now,
           redeemed_by             = v_caller,
           distribution_logged_at  = v_now,
           distribution_logged_by  = v_caller,
           prize_note              = COALESCE(v_prize_note, prize_note),
           extra_gift_card_cents   = COALESCE(p_extra_cents, extra_gift_card_cents)
     WHERE id = v_tok.id;

    -- Consumable side-effect: if the passport is consumable AND
    -- the holder's most-recent instance is consumed AND that
    -- instance was configured to reissue, issue the next sequence.
    -- The partial unique index on (collector_passport_id) WHERE
    -- consumed_at IS NULL guarantees there's no concurrent active
    -- instance to collide with.
    IF v_passport.credential_type = 'consumable' THEN
      SELECT ci.*
        INTO v_last_instance
        FROM public.card_instances ci
        JOIN public.collector_passports cp ON cp.id = ci.collector_passport_id
       WHERE cp.user_id = v_tok.user_id
         AND cp.passport_id = v_tok.passport_id
       ORDER BY ci.sequence DESC
       LIMIT 1;

      IF FOUND
         AND v_last_instance.consumed_at IS NOT NULL
         AND COALESCE(v_last_instance.reissue_on_completion, false)
      THEN
        INSERT INTO public.card_instances
          (collector_passport_id, sequence, target_count, reissue_on_completion)
        VALUES
          (v_last_instance.collector_passport_id,
           v_last_instance.sequence + 1,
           v_last_instance.target_count,
           true);
      END IF;
    END IF;
  ELSE
    -- action = 'pending'
    UPDATE public.completion_tokens
       SET distribution_pending = true,
           prize_note           = COALESCE(v_prize_note, prize_note)
     WHERE id = v_tok.id;
  END IF;

  SELECT * INTO v_updated FROM public.completion_tokens WHERE id = v_tok.id;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_completion(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_completion(text, text, text, integer) TO authenticated;
