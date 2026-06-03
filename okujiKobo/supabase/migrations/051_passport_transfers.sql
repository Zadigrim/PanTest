-- Passport ownership transfers with offer-and-accept.
--
-- Flow: a platform admin initiates a transfer to a recipient (an
-- individual user OR an institution). The recipient gets a pending
-- offer they can Accept or Decline; the admin can also Cancel a
-- pending offer. On Accept, the passport's ownership is moved per the
-- semantics below. On Decline/Cancel, nothing on the passport changes.
--
-- TRANSFER SEMANTICS (on accept — FULL handoff):
--
--   To an INSTITUTION:
--     proprietor_id  → recipient institution
--     creator_id     → okuji_custodial_id() (the system account)
--   So the institution's can_design employees control it via the
--   proprietor branch of the existing RLS, and the original creator
--   loses all editing access (they're no longer creator_id). The
--   custodial account is non-personal and never acts on its own.
--
--   To an INDIVIDUAL:
--     creator_id     → recipient user
--     proprietor_id  → NULL
--   It appears in the recipient's "My Passports" and they design /
--   publish it fully.
--
-- COLLECTORS UNAFFECTED: acquisitions, stamps, journals all key off
-- passport_id and user_id (the collector), not creator_id, so a
-- creator-side reassignment doesn't touch them.
--
-- Pricing + publish state: unchanged by transfer.
--
-- Authorization (server-enforced in SECURITY DEFINER functions):
--   initiate  → is_platform_admin
--   accept    → recipient (the to_user OR a can_manage_employees of
--                the to_institution)
--   decline   → recipient (same as accept)
--   cancel    → is_platform_admin OR the original initiator
--
-- FUTURE: creator-initiated transfers (a non-admin offering their own
-- passport to someone) belong in initiate_passport_transfer with the
-- caller-is-creator branch added — leave that for when the use case
-- exists. The admin-only gate is fine for the "Nathan hands a pitch
-- passport to a library" flow.

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.passport_transfers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id         uuid NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  -- Snapshots of the from-state so the audit trail survives a later
  -- account closure of the original creator. Not FKs — they may
  -- reference a now-deleted profile or institution.
  from_creator_id     uuid,
  from_proprietor_id  uuid,
  -- Exactly one of these is set (enforced by the CHECK below).
  to_user_id          uuid REFERENCES public.profiles(id)     ON DELETE CASCADE,
  to_institution_id   uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  initiated_by        uuid NOT NULL REFERENCES public.profiles(id),
  initiated_at        timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'declined', 'canceled')),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES public.profiles(id),
  note                text,
  CHECK (
    (to_user_id IS NOT NULL AND to_institution_id IS NULL)
    OR (to_user_id IS NULL AND to_institution_id IS NOT NULL)
  )
);

-- One pending offer per passport — initiating a new transfer for a
-- passport that already has a pending one is handled by canceling the
-- prior one in initiate_passport_transfer().
CREATE UNIQUE INDEX IF NOT EXISTS passport_transfers_one_pending_per_passport
  ON public.passport_transfers (passport_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS passport_transfers_to_user_pending_idx
  ON public.passport_transfers (to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS passport_transfers_to_institution_pending_idx
  ON public.passport_transfers (to_institution_id)
  WHERE status = 'pending';

-- ── 2. RLS — read-only via policies; mutations go through SECURITY DEFINER ──

ALTER TABLE public.passport_transfers ENABLE ROW LEVEL SECURITY;

-- Platform admins see everything.
DROP POLICY IF EXISTS "transfers_select_admin" ON public.passport_transfers;
CREATE POLICY "transfers_select_admin"
  ON public.passport_transfers FOR SELECT TO authenticated
  USING (public.is_admin() = true);

-- An individual recipient sees their own pending / past offers.
DROP POLICY IF EXISTS "transfers_select_to_user" ON public.passport_transfers;
CREATE POLICY "transfers_select_to_user"
  ON public.passport_transfers FOR SELECT TO authenticated
  USING (to_user_id = auth.uid());

-- Anyone with can_manage_employees at the target institution sees
-- offers addressed to that institution. can_manage_employees is the
-- closest existing "speaks for the institution" authority — same
-- bar as adding/removing employees.
DROP POLICY IF EXISTS "transfers_select_institution" ON public.passport_transfers;
CREATE POLICY "transfers_select_institution"
  ON public.passport_transfers FOR SELECT TO authenticated
  USING (
    to_institution_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = auth.uid()
         AND ea.institution_id = passport_transfers.to_institution_id
         AND ea.can_manage_employees = true
    )
  );

-- The admin who initiated the transfer can always read it back.
DROP POLICY IF EXISTS "transfers_select_initiator" ON public.passport_transfers;
CREATE POLICY "transfers_select_initiator"
  ON public.passport_transfers FOR SELECT TO authenticated
  USING (initiated_by = auth.uid());

-- No INSERT/UPDATE/DELETE policies. All writes must go through the
-- SECURITY DEFINER functions below, which run their own auth checks.

-- ── 3. SECURITY DEFINER mutation functions ──────────────────────────────────

-- Initiate a transfer. Admin-only. Cancels any existing pending
-- transfer for the same passport so the unique-pending index never
-- conflicts. Returns the new transfer id.
CREATE OR REPLACE FUNCTION public.initiate_passport_transfer(
  p_passport_id       uuid,
  p_to_user_id        uuid,
  p_to_institution_id uuid,
  p_note              text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  is_admin  boolean;
  p         record;
  new_id    uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  SELECT COALESCE(is_platform_admin, false) INTO is_admin
    FROM public.profiles WHERE id = caller_id;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'platform admin required';
  END IF;

  IF (p_to_user_id IS NULL) = (p_to_institution_id IS NULL) THEN
    RAISE EXCEPTION 'supply exactly one of to_user_id / to_institution_id';
  END IF;

  SELECT creator_id, proprietor_id INTO p
    FROM public.passports WHERE id = p_passport_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'passport not found';
  END IF;

  -- Cancel any prior pending offer for this passport.
  UPDATE public.passport_transfers
     SET status      = 'canceled',
         resolved_at = now(),
         resolved_by = caller_id
   WHERE passport_id = p_passport_id
     AND status      = 'pending';

  INSERT INTO public.passport_transfers (
    passport_id, from_creator_id, from_proprietor_id,
    to_user_id, to_institution_id,
    initiated_by, status, note
  ) VALUES (
    p_passport_id, p.creator_id, p.proprietor_id,
    p_to_user_id, p_to_institution_id,
    caller_id, 'pending', p_note
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_passport_transfer(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initiate_passport_transfer(uuid, uuid, uuid, text) TO authenticated;

-- Accept a pending transfer. Only the recipient may accept. Atomically
-- moves ownership per the semantics in the header.
CREATE OR REPLACE FUNCTION public.accept_passport_transfer(
  p_transfer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller_id     uuid := auth.uid();
  t             record;
  can_accept    boolean := false;
  new_creator   uuid;
  new_proprietor uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- Lock the row for the duration of the transaction.
  SELECT * INTO t FROM public.passport_transfers
   WHERE id = p_transfer_id FOR UPDATE;
  IF t IS NULL THEN
    RAISE EXCEPTION 'transfer not found';
  END IF;
  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer is %, not pending', t.status;
  END IF;

  -- Authorization.
  IF t.to_user_id IS NOT NULL THEN
    can_accept := (t.to_user_id = caller_id);
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = caller_id
         AND ea.institution_id = t.to_institution_id
         AND ea.can_manage_employees = true
    ) INTO can_accept;
  END IF;
  IF NOT can_accept THEN
    RAISE EXCEPTION 'not authorized to accept this transfer';
  END IF;

  -- Compute new ownership.
  IF t.to_institution_id IS NOT NULL THEN
    -- Institution recipient: control flows through proprietor_id +
    -- can_design. creator_id → custodial removes the original
    -- creator's editing rights without leaving a dangling FK.
    new_creator    := public.okuji_custodial_id();
    new_proprietor := t.to_institution_id;
  ELSE
    new_creator    := t.to_user_id;
    new_proprietor := NULL;
  END IF;

  -- Apply ownership change.
  UPDATE public.passports
     SET creator_id    = new_creator,
         proprietor_id = new_proprietor
   WHERE id = t.passport_id;

  -- Mark accepted.
  UPDATE public.passport_transfers
     SET status      = 'accepted',
         resolved_at = now(),
         resolved_by = caller_id
   WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id',       p_transfer_id,
    'passport_id',       t.passport_id,
    'new_creator_id',    new_creator,
    'new_proprietor_id', new_proprietor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_passport_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_passport_transfer(uuid) TO authenticated;

-- Decline a pending transfer. Only the recipient.
CREATE OR REPLACE FUNCTION public.decline_passport_transfer(
  p_transfer_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  t         record;
  ok        boolean := false;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO t FROM public.passport_transfers
   WHERE id = p_transfer_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer is %, not pending', t.status;
  END IF;

  IF t.to_user_id IS NOT NULL THEN
    ok := (t.to_user_id = caller_id);
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = caller_id
         AND ea.institution_id = t.to_institution_id
         AND ea.can_manage_employees = true
    ) INTO ok;
  END IF;
  IF NOT ok THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE public.passport_transfers
     SET status      = 'declined',
         resolved_at = now(),
         resolved_by = caller_id
   WHERE id = p_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_passport_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_passport_transfer(uuid) TO authenticated;

-- Cancel a pending transfer. Platform admin OR the original initiator.
CREATE OR REPLACE FUNCTION public.cancel_passport_transfer(
  p_transfer_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller_id uuid := auth.uid();
  is_admin  boolean;
  t         record;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO t FROM public.passport_transfers
   WHERE id = p_transfer_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer is %, not pending', t.status;
  END IF;

  SELECT COALESCE(is_platform_admin, false) INTO is_admin
    FROM public.profiles WHERE id = caller_id;
  IF NOT (is_admin OR t.initiated_by = caller_id) THEN
    RAISE EXCEPTION 'not authorized to cancel';
  END IF;

  UPDATE public.passport_transfers
     SET status      = 'canceled',
         resolved_at = now(),
         resolved_by = caller_id
   WHERE id = p_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_passport_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_passport_transfer(uuid) TO authenticated;
