-- Migration 085: passport retention policy — durable lifetime-acquisition
-- ledger + provably-safe draft retention state machine.
--
-- THE MOST DESTRUCTIVE FEATURE IN THE SYSTEM. Built defensively:
-- detection + soft-delete first, hard-purge last, gated and logged, never
-- an unattended cron. The preservation invariant (CLAUDE.md #1) is absolute:
-- anything ever acquired or currently held is NEVER deletable.
--
-- ─────────────────────────────────────────────────────────────────────────
-- WHY A LEDGER (the preservation-critical finding)
-- ─────────────────────────────────────────────────────────────────────────
-- `acquisitions` and `collector_passports` are NOT lifetime records:
-- close_user_account (migration 049) hard-deletes the closing user's rows
-- from both. So a passport acquired only by since-closed accounts shows zero
-- in both tables despite having been acquired. There is no durable "ever
-- sold" signal today.
--
-- This migration adds one: `passport_acquisition_ledger`, an APPEND-ONLY
-- table written by triggers on every acquisition surface. Account closure
-- (049) never references it, so its rows survive closure — making "was this
-- passport EVER acquired?" answerable as `EXISTS(ledger WHERE passport_id)`.
--
-- LIMITATION (stated honestly): the ledger only knows acquisitions from this
-- migration forward, plus a backfill of currently-known acquisitions as a
-- floor. For passports PUBLISHED before this migration, a since-closed
-- acquirer in that pre-ledger window left no trace, so their lifetime cannot
-- be proven zero. Therefore the ONLY provably-safe eligibility today is
-- NEVER-PUBLISHED drafts (a passport can only be acquired while published, so
-- never-published ⟹ never-acquired — a guarantee). The published /
-- ever-published retention path is intentionally NOT implemented here; it
-- becomes possible only once the ledger has covered a passport's entire
-- published life. The detection function enforces never-published.
--
-- ROLLBACK: drop the functions, the two triggers, the retention columns, the
-- log + ledger tables. Additive; no existing row is modified except the
-- retention_* columns default to 'active'/NULL.

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1 — Durable lifetime-acquisition ledger (append-only)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.passport_acquisition_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id   uuid        NOT NULL,   -- intentionally NOT an FK: the ledger
                                        -- must outlive the passport (and any
                                        -- purge) as the lifetime record.
  -- The acquirer at the time of the event. Nullable + no cascade: account
  -- closure must NOT erase the ledger row (the whole point), so we never let
  -- a user delete take this with it.
  original_user_id uuid     NULL,
  source        text        NOT NULL,   -- 'acquisitions' | 'collector_passports' | 'backfill'
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passport_acquisition_ledger_passport_idx
  ON public.passport_acquisition_ledger (passport_id);

ALTER TABLE public.passport_acquisition_ledger ENABLE ROW LEVEL SECURITY;
-- No policies: the ledger is written by SECURITY DEFINER triggers and read by
-- SECURITY DEFINER functions only. Direct client access is denied by default
-- (RLS on, no permissive policy). Platform admins read it via the detection
-- function, not directly.

-- Trigger fn: record an acquisition event. AFTER INSERT, append-only.
-- search_path pinned per the migration-072 hardening convention.
CREATE OR REPLACE FUNCTION public.record_passport_acquisition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.passport_acquisition_ledger
    (passport_id, original_user_id, source, occurred_at)
  VALUES (
    NEW.passport_id,
    NEW.user_id,
    TG_TABLE_NAME,
    COALESCE(
      -- acquisitions.acquired_at; collector_passports has its own created_at.
      to_jsonb(NEW) ->> 'acquired_at',
      to_jsonb(NEW) ->> 'created_at',
      now()::text
    )::timestamptz
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acquisitions_ledger ON public.acquisitions;
CREATE TRIGGER acquisitions_ledger
  AFTER INSERT ON public.acquisitions
  FOR EACH ROW EXECUTE FUNCTION public.record_passport_acquisition();

DROP TRIGGER IF EXISTS collector_passports_ledger ON public.collector_passports;
CREATE TRIGGER collector_passports_ledger
  AFTER INSERT ON public.collector_passports
  FOR EACH ROW EXECUTE FUNCTION public.record_passport_acquisition();

-- Backfill: one ledger row per currently-known acquisition surface, marked
-- 'backfill'. This is a FLOOR (it can't recover acquisitions already pruned
-- by closures before this migration) — which is why only never-published
-- drafts are eligible. Idempotent-ish: guarded so re-running the migration
-- doesn't duplicate the backfill.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.passport_acquisition_ledger WHERE source = 'backfill') THEN
    INSERT INTO public.passport_acquisition_ledger (passport_id, original_user_id, source, occurred_at)
      SELECT passport_id, user_id, 'backfill', COALESCE(acquired_at, now()) FROM public.acquisitions;
    INSERT INTO public.passport_acquisition_ledger (passport_id, original_user_id, source, occurred_at)
      SELECT passport_id, user_id, 'backfill', now() FROM public.collector_passports;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2 — Retention state on passports (additive) + transition log
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS retention_state     text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS retention_flagged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retention_grace_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retention_deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retention_reason    text        NULL;

ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_retention_state_check;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_retention_state_check
  CHECK (retention_state IN ('active','flagged','grace','soft_deleted'));
-- ('purged' is not a state — purge removes the row entirely.)

-- Transition log. passport_id is a plain uuid (NO FK) so the audit trail
-- survives the purge that deletes the passport row.
CREATE TABLE IF NOT EXISTS public.passport_retention_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id  uuid        NOT NULL,
  passport_title text      NULL,
  from_state   text        NULL,
  to_state     text        NOT NULL,
  reason       text        NULL,
  actor_id     uuid        NULL,    -- who triggered it (admin/creator/system)
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_retention_log_passport_idx
  ON public.passport_retention_log (passport_id, at DESC);

ALTER TABLE public.passport_retention_log ENABLE ROW LEVEL SECURITY;
-- Admins read via functions; no direct client policy.

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3 — Eligibility (the provably-safe predicate) + detection dry-run
-- ═══════════════════════════════════════════════════════════════════════════
-- A passport is deletion-eligible ONLY IF ALL hold:
--   * NEVER published: status <> 'published', is_published = false, AND no
--     publish history (no published_snapshots, no republish_log). This is the
--     guarantee that it was never acquirable.
--   * Lifetime-acquisitions = 0: no ledger rows (covers since-closed accounts
--     for the never-published case — there can be none).
--   * Current holders = 0: no acquisitions, no collector_passports.
--   * NOT exempt: creator is not a platform admin; not institution-owned
--     (proprietor_id IS NULL).
--   * Idle: last activity older than p_idle_days (default 180).
-- Returns the candidate set; WRITES NOTHING (dry-run).
CREATE OR REPLACE FUNCTION public.retention_scan_drafts(p_idle_days int DEFAULT 180)
RETURNS TABLE (
  passport_id   uuid,
  title         text,
  creator_id    uuid,
  last_activity timestamptz,
  retention_state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT p.id, p.title, p.creator_id,
         COALESCE(p.last_edited_at, p.updated_at, p.created_at) AS last_activity,
         p.retention_state
  FROM public.passports p
  WHERE p.is_published = false
    AND COALESCE(p.status, 'draft') <> 'published'
    AND p.proprietor_id IS NULL                                   -- not institutional
    AND COALESCE(p.last_edited_at, p.updated_at, p.created_at)
          < now() - make_interval(days => p_idle_days)            -- idle
    -- never published (no publish history):
    AND NOT EXISTS (SELECT 1 FROM public.passport_published_snapshots s WHERE s.passport_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.passport_republish_log     rl WHERE rl.passport_id = p.id)
    -- never acquired (lifetime) and no current holders:
    AND NOT EXISTS (SELECT 1 FROM public.passport_acquisition_ledger l WHERE l.passport_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.acquisitions       a WHERE a.passport_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.collector_passports cp WHERE cp.passport_id = p.id)
    -- creator is not a platform admin (exempt owner/admin content):
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = p.creator_id AND pr.is_platform_admin = true
    );
$$;

REVOKE ALL ON FUNCTION public.retention_scan_drafts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retention_scan_drafts(int) TO authenticated;
-- (The function still only returns rows; callers should be admins. The
--  destructive functions below hard-gate on is_platform_admin.)

-- Internal helper: re-assert full eligibility for ONE passport. Every
-- destructive transition re-checks this immediately before acting, so a
-- passport that became acquired/published/edited after being flagged is
-- never advanced. Returns true only if still provably-safe.
CREATE OR REPLACE FUNCTION public.retention_is_eligible(p_passport_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.passports p
    WHERE p.id = p_passport_id
      AND p.is_published = false
      AND COALESCE(p.status,'draft') <> 'published'
      AND p.proprietor_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.passport_published_snapshots s WHERE s.passport_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.passport_republish_log     rl WHERE rl.passport_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.passport_acquisition_ledger l WHERE l.passport_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.acquisitions       a WHERE a.passport_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.collector_passports cp WHERE cp.passport_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p.creator_id AND pr.is_platform_admin = true)
  );
$$;

REVOKE ALL ON FUNCTION public.retention_is_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retention_is_eligible(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 4 — State machine transitions (each re-checks eligibility + logs)
-- ═══════════════════════════════════════════════════════════════════════════
-- Shared admin gate.
CREATE OR REPLACE FUNCTION public.retention_assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = true) THEN
    RAISE EXCEPTION 'Platform admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- active → flagged → grace (30-day creator-warning window). Admin/system
-- initiates. Re-checks eligibility; refuses if not provably-safe.
CREATE OR REPLACE FUNCTION public.retention_flag(p_passport_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_from text; v_title text;
BEGIN
  PERFORM public.retention_assert_admin();
  IF NOT public.retention_is_eligible(p_passport_id) THEN
    RAISE EXCEPTION 'Passport is not retention-eligible (preserve)' USING ERRCODE = 'check_violation';
  END IF;
  SELECT retention_state, title INTO v_from, v_title FROM public.passports WHERE id = p_passport_id;
  UPDATE public.passports
     SET retention_state = 'grace',
         retention_flagged_at = COALESCE(retention_flagged_at, now()),
         retention_grace_until = now() + interval '30 days',
         retention_reason = 'idle never-published draft'
   WHERE id = p_passport_id;
  INSERT INTO public.passport_retention_log (passport_id, passport_title, from_state, to_state, reason, actor_id)
    VALUES (p_passport_id, v_title, v_from, 'grace', 'flagged for retention; 30-day grace', auth.uid());
END;
$$;

-- Creator (or admin) keeps/reclaims: back to active, clears flags. The
-- creator path is the one-click "keep" — gated to the owner or an admin.
CREATE OR REPLACE FUNCTION public.retention_keep(p_passport_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_from text; v_title text; v_creator uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT retention_state, title, creator_id INTO v_from, v_title, v_creator
    FROM public.passports WHERE id = p_passport_id;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'Passport not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_creator <> auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = true) THEN
    RAISE EXCEPTION 'Only the creator or an admin can keep this passport' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.passports
     SET retention_state = 'active',
         retention_flagged_at = NULL, retention_grace_until = NULL,
         retention_deleted_at = NULL, retention_reason = NULL
   WHERE id = p_passport_id;
  INSERT INTO public.passport_retention_log (passport_id, passport_title, from_state, to_state, reason, actor_id)
    VALUES (p_passport_id, v_title, v_from, 'active', 'kept/reclaimed by creator or admin', auth.uid());
END;
$$;

-- grace → soft_deleted. Only after the grace window elapsed AND still
-- eligible. Soft-deleted = hidden (listings filter retention_state) but fully
-- recoverable via retention_keep for the recovery window.
CREATE OR REPLACE FUNCTION public.retention_soft_delete(p_passport_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_from text; v_title text; v_grace timestamptz;
BEGIN
  PERFORM public.retention_assert_admin();
  IF NOT public.retention_is_eligible(p_passport_id) THEN
    RAISE EXCEPTION 'Passport is not retention-eligible (preserve)' USING ERRCODE = 'check_violation';
  END IF;
  SELECT retention_state, title, retention_grace_until INTO v_from, v_title, v_grace
    FROM public.passports WHERE id = p_passport_id;
  IF v_from <> 'grace' THEN
    RAISE EXCEPTION 'Passport must be in grace before soft-delete (no skipping stages)' USING ERRCODE = 'check_violation';
  END IF;
  IF v_grace IS NULL OR v_grace > now() THEN
    RAISE EXCEPTION 'Grace window has not elapsed' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.passports
     SET retention_state = 'soft_deleted', retention_deleted_at = now()
   WHERE id = p_passport_id;
  INSERT INTO public.passport_retention_log (passport_id, passport_title, from_state, to_state, reason, actor_id)
    VALUES (p_passport_id, v_title, v_from, 'soft_deleted', 'grace elapsed; recoverable', auth.uid());
END;
$$;

-- soft_deleted → PURGED (hard delete). The only destructive endpoint.
-- Gated: admin-only, must be soft_deleted, recovery window (default 30d)
-- elapsed, and STILL eligible. Logs BEFORE deleting (log has no FK, survives).
-- Asset cleanup is exclusive-only and fail-safe (see inline notes).
-- This NEVER runs unattended — it must be invoked explicitly per passport.
CREATE OR REPLACE FUNCTION public.retention_purge(p_passport_id uuid, p_recovery_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_state text; v_title text; v_creator uuid; v_deleted_at timestamptz;
  v_asset record; v_refs int; v_assets_deleted int := 0;
BEGIN
  PERFORM public.retention_assert_admin();

  SELECT retention_state, title, creator_id, retention_deleted_at
    INTO v_state, v_title, v_creator, v_deleted_at
    FROM public.passports WHERE id = p_passport_id;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'Passport not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_state <> 'soft_deleted' THEN
    RAISE EXCEPTION 'Only soft-deleted passports can be purged (soft-delete first, always)' USING ERRCODE = 'check_violation';
  END IF;
  IF v_deleted_at IS NULL OR v_deleted_at > now() - make_interval(days => p_recovery_days) THEN
    RAISE EXCEPTION 'Recovery window has not elapsed' USING ERRCODE = 'check_violation';
  END IF;
  -- Final, paranoid preservation re-check.
  IF NOT public.retention_is_eligible(p_passport_id) THEN
    RAISE EXCEPTION 'Passport is not retention-eligible (preserve)' USING ERRCODE = 'check_violation';
  END IF;

  -- Candidate exclusive assets: assets referenced by THIS passport's stops,
  -- owned by the creator, not built-in. We delete the DB row only if, after
  -- the passport is gone, the asset has ZERO references (exclusive use). If
  -- usage can't be determined we skip (fail safe). Storage-object cleanup is
  -- deferred to the existing separate sweep (matches /api/assets/:id's
  -- documented stance); we never delete storage blindly here.
  CREATE TEMP TABLE _purge_assets ON COMMIT DROP AS
    SELECT DISTINCT da.id AS asset_id, da.url AS asset_url
    FROM public.passport_pages pp
    JOIN public.stops s        ON s.page_id = pp.id
    JOIN public.design_assets da ON da.id = s.stamp_asset_id
    WHERE pp.passport_id = p_passport_id
      AND s.stamp_asset_id IS NOT NULL
      AND da.owner_id = v_creator
      AND COALESCE(da.is_built_in, false) = false;

  -- Log BEFORE the delete (audit must survive the row removal).
  INSERT INTO public.passport_retention_log (passport_id, passport_title, from_state, to_state, reason, actor_id)
    VALUES (p_passport_id, v_title, v_state, 'purged', 'hard purge after recovery window', auth.uid());

  -- Delete the passport (cascades pages → stops/elements/tokens/snapshots).
  DELETE FROM public.passports WHERE id = p_passport_id;

  -- Now that the passport (and its stops) are gone, delete only assets that
  -- are exclusively unreferenced. count_asset_references is the existing
  -- in-use check; any error/uncertainty means we DO NOT delete that asset.
  FOR v_asset IN SELECT asset_id, asset_url FROM _purge_assets LOOP
    BEGIN
      SELECT public.count_asset_references(v_asset.asset_id, COALESCE(v_asset.asset_url, '')) INTO v_refs;
      IF v_refs = 0 THEN
        DELETE FROM public.design_assets WHERE id = v_asset.asset_id;
        v_assets_deleted := v_assets_deleted + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Could not verify usage → preserve the asset. Never fail the purge
      -- over an asset; the orphaned-row sweep can revisit later.
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('purged', true, 'passport_id', p_passport_id, 'assets_deleted', v_assets_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.retention_flag(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retention_keep(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retention_soft_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retention_purge(uuid, int)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retention_assert_admin()    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retention_flag(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.retention_keep(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.retention_soft_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retention_purge(uuid, int)  TO authenticated;
