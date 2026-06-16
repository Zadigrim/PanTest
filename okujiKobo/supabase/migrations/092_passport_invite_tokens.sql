-- 092_passport_invite_tokens.sql
--
-- Private-passport invite tokens. Net-new, clean schema — does NOT use or
-- revive share_tokens. Mirrors the M3 stop-QR-token pattern: an
-- unguessable token, admin-only direct table access, and SECURITY DEFINER
-- RPCs as the only interface (generate + redeem-and-acquire), validated
-- server-side and fail closed.
--
-- Two modes (generation-time toggle):
--   single_use  (default) — one token -> one acquisition; consumed_at is
--                set on redemption (STATE, never DELETE — consistent with
--                the consumed_at preservation rule).
--   reusable    — one token, many redemptions; optional max_uses cap and
--                optional expires_at; uses_count tracks redemptions.

CREATE TABLE IF NOT EXISTS public.passport_invite_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id  uuid NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  created_by   uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  mode         text NOT NULL DEFAULT 'single_use' CHECK (mode IN ('single_use', 'reusable')),
  max_uses     integer,            -- nullable; only meaningful for reusable
  uses_count   integer NOT NULL DEFAULT 0,
  expires_at   timestamptz,        -- nullable; no expiry when null
  consumed_at  timestamptz,        -- single_use state (never DELETE)
  consumed_by  uuid REFERENCES public.profiles(id),
  CONSTRAINT passport_invite_tokens_max_uses_positive
    CHECK (max_uses IS NULL OR max_uses > 0)
);

CREATE INDEX IF NOT EXISTS passport_invite_tokens_passport_idx
  ON public.passport_invite_tokens (passport_id);

ALTER TABLE public.passport_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Admin-only direct access; creators/collectors go through the RPCs below
-- (the generate RPC returns the token once). Mirrors stop_qr_tokens.
DROP POLICY IF EXISTS "invite_tokens_admin" ON public.passport_invite_tokens;
CREATE POLICY "invite_tokens_admin" ON public.passport_invite_tokens
  FOR ALL USING (public.is_admin());

-- ── generate ────────────────────────────────────────────────────────────
-- Authorize like passport management: admin / creator / can_design at the
-- proprietor. Returns the token text for one-time display.
CREATE OR REPLACE FUNCTION public.generate_passport_invite_token(
  p_passport_id uuid,
  p_mode        text        DEFAULT 'single_use',
  p_max_uses    integer     DEFAULT NULL,
  p_expires_at  timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_creator    uuid;
  v_proprietor uuid;
  v_authorized boolean := false;
  v_token      text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('single_use', 'reusable') THEN
    RAISE EXCEPTION 'invalid mode (single_use or reusable)' USING ERRCODE = '22023';
  END IF;

  SELECT creator_id, proprietor_id INTO v_creator, v_proprietor
    FROM public.passports WHERE id = p_passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'passport not found' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_platform_admin() THEN
    v_authorized := true;
  ELSIF v_creator = v_caller THEN
    v_authorized := true;
  ELSIF v_proprietor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = v_caller
         AND ea.institution_id = v_proprietor
         AND ea.can_design = true
    ) INTO v_authorized;
  END IF;
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized to create invite tokens for this passport' USING ERRCODE = '42501';
  END IF;

  -- 16 random bytes -> base64url, INV- prefix to distinguish at-a-glance
  -- from stop QR tokens (M3-...) and completion codes (OKJ-...).
  v_token := 'INV-' || translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_');

  INSERT INTO public.passport_invite_tokens
    (passport_id, token, created_by, mode, max_uses, expires_at)
  VALUES
    (p_passport_id, v_token, v_caller, p_mode,
     CASE WHEN p_mode = 'reusable' THEN p_max_uses ELSE NULL END,
     p_expires_at);

  RETURN v_token;
END;
$$;

-- ── redeem + acquire ─────────────────────────────────────────────────────
-- Collector-side. Validates the token (mode / max_uses / expiry / state),
-- confirms the passport is in a redeemable state, then mirrors the
-- /api/acquire path (acquisitions insert + ensure_collector_passport).
-- Returns the collector_passport id. Fail closed.
--
-- Redeemable = is_published AND review_status='approved'. Institution
-- passports are auto-approved on publish; Studio passports require admin
-- approval; pending/rejected is never redeemable.
CREATE OR REPLACE FUNCTION public.redeem_passport_invite_token_and_acquire(
  p_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_tok      public.passport_invite_tokens%ROWTYPE;
  v_passport public.passports%ROWTYPE;
  v_existing uuid;
  v_cp_id    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Lock the token so concurrent redemptions serialise.
  SELECT * INTO v_tok FROM public.passport_invite_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite token' USING ERRCODE = '22023';
  END IF;

  IF v_tok.expires_at IS NOT NULL AND v_tok.expires_at < now() THEN
    RAISE EXCEPTION 'invite token expired' USING ERRCODE = '22023';
  END IF;
  IF v_tok.mode = 'single_use' AND v_tok.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite token already used' USING ERRCODE = '22023';
  END IF;
  IF v_tok.mode = 'reusable' AND v_tok.max_uses IS NOT NULL AND v_tok.uses_count >= v_tok.max_uses THEN
    RAISE EXCEPTION 'invite token has no remaining uses' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_passport FROM public.passports WHERE id = v_tok.passport_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'passport not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_passport.is_published IS NOT TRUE OR v_passport.review_status <> 'approved' THEN
    RAISE EXCEPTION 'passport is not available for redemption' USING ERRCODE = '22023';
  END IF;

  -- Already owned: return the existing holder record without spending the
  -- token (a re-redeem by the same user must not burn a single-use token).
  SELECT id INTO v_existing
    FROM public.acquisitions
   WHERE user_id = v_caller AND passport_id = v_tok.passport_id;
  IF FOUND THEN
    SELECT id INTO v_cp_id
      FROM public.collector_passports
     WHERE user_id = v_caller AND passport_id = v_tok.passport_id;
    IF v_cp_id IS NULL THEN
      SELECT cp.id INTO v_cp_id
        FROM public.ensure_collector_passport(p_user_id => v_caller, p_passport_id => v_tok.passport_id) cp;
    END IF;
    RETURN v_cp_id;
  END IF;

  -- New acquisition. The token IS the grant — access is free for invitees.
  INSERT INTO public.acquisitions (user_id, passport_id, price_paid_cents)
  VALUES (v_caller, v_tok.passport_id, 0);

  SELECT cp.id INTO v_cp_id
    FROM public.ensure_collector_passport(p_user_id => v_caller, p_passport_id => v_tok.passport_id) cp;

  -- Spend the token (state, never DELETE).
  IF v_tok.mode = 'single_use' THEN
    UPDATE public.passport_invite_tokens
       SET consumed_at = now(), consumed_by = v_caller, uses_count = uses_count + 1
     WHERE id = v_tok.id;
  ELSE
    UPDATE public.passport_invite_tokens
       SET uses_count = uses_count + 1
     WHERE id = v_tok.id;
  END IF;

  RETURN v_cp_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_passport_invite_token(uuid, text, integer, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_passport_invite_token_and_acquire(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_passport_invite_token(uuid, text, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_passport_invite_token_and_acquire(text) TO authenticated;
