-- Migration 095: force-purge erases ownership traces too ("as if never owned").
--
-- Refines public.force_purge_passport(uuid) from migration 094. 094 already
-- removes the passport from every collector's inventory — the web library
-- reads `acquisitions` and the mobile library reads `collector_passports`,
-- both of which 094 deletes. The ONE thing 094 deliberately preserved was
-- `passport_acquisition_ledger` (085): the append-only lifetime record whose
-- whole purpose is to answer "was this passport EVER acquired?" so the
-- retention system can't be tricked into purging an ever-published passport.
--
-- The owner's requirement for the FORCE path is total erasure — "as if they've
-- never owned it" — so this version also deletes the ledger rows for the
-- passport. This is safe and consistent: the ledger is only ever consulted for
-- passports that still EXIST (to gate retention eligibility); a force-purged
-- passport is gone, so its ledger rows are dead weight that nothing reads
-- again. Erasing them simply removes the last residual ownership trace.
--
-- This is a self-contained CREATE OR REPLACE (supersedes the 094 body); it
-- depends only on helpers from 085 (retention_assert_admin, passport_retention_log,
-- count_asset_references). Everything else is identical to 094 — see that
-- migration's header for the full FK map and safety model.
--
-- ROLLBACK: re-apply 094 to restore the ledger-preserving body, or drop the
-- function. Additive; modifies no existing row.

CREATE OR REPLACE FUNCTION public.force_purge_passport(p_passport_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_title   text;
  v_creator uuid;
  v_pages    uuid[];
  v_stops    uuid[];
  v_cp       uuid[];
  v_cards    uuid[];
  v_stamps   uuid[];
  v_journals uuid[];
  v_journeys uuid[];
  v_assets_deleted int := 0;
  v_holders int := 0;
  v_ledger_erased int := 0;
  v_asset record; v_refs int;
BEGIN
  PERFORM public.retention_assert_admin();

  SELECT title, creator_id INTO v_title, v_creator
    FROM public.passports WHERE id = p_passport_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Passport not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- ── Resolve every passport-scoped id set up front (arrays, so the order
  --    of deletes below is independent of which rows still exist). ──────────
  SELECT COALESCE(array_agg(id), '{}') INTO v_pages
    FROM public.passport_pages WHERE passport_id = p_passport_id;
  SELECT COALESCE(array_agg(s.id), '{}') INTO v_stops
    FROM public.stops s WHERE s.page_id = ANY(v_pages);
  SELECT COALESCE(array_agg(id), '{}') INTO v_cp
    FROM public.collector_passports WHERE passport_id = p_passport_id;
  SELECT COALESCE(array_agg(id), '{}') INTO v_cards
    FROM public.card_instances WHERE collector_passport_id = ANY(v_cp);
  SELECT COALESCE(array_agg(id), '{}') INTO v_stamps
    FROM public.stamps
    WHERE passport_id = p_passport_id
       OR collector_passport_id = ANY(v_cp)
       OR stop_id = ANY(v_stops);
  SELECT COALESCE(array_agg(id), '{}') INTO v_journals
    FROM public.journal_entries
    WHERE passport_id = p_passport_id
       OR stamp_id = ANY(v_stamps)
       OR stop_id = ANY(v_stops);
  SELECT COALESCE(array_agg(id), '{}') INTO v_journeys
    FROM public.journeys WHERE passport_id = p_passport_id;

  v_holders := COALESCE(array_length(v_cp, 1), 0);

  -- ── Exclusive-asset candidates (mirrors retention_purge): assets used only
  --    by THIS passport's stops, owned by the creator, not built-in. Computed
  --    BEFORE the delete; the row is removed AFTER, only if then unreferenced.
  CREATE TEMP TABLE IF NOT EXISTS _fp_assets (asset_id uuid, asset_url text) ON COMMIT DROP;
  DELETE FROM _fp_assets;
  INSERT INTO _fp_assets
    SELECT DISTINCT da.id, da.url
    FROM public.stops s
    JOIN public.design_assets da ON da.id = s.stamp_asset_id
    WHERE s.id = ANY(v_stops)
      AND s.stamp_asset_id IS NOT NULL
      AND da.owner_id = v_creator
      AND COALESCE(da.is_built_in, false) = false;

  -- ── Audit BEFORE the delete (must survive row removal). ──────────────────
  INSERT INTO public.passport_retention_log
    (passport_id, passport_title, from_state, to_state, reason, actor_id)
    VALUES (p_passport_id, v_title, 'force', 'force_purged',
            'admin force-purge (cascade, overrides preservation, erases ownership)', auth.uid());

  -- ── Break the stamps ↔ accolades cycle. ──────────────────────────────────
  UPDATE public.stamps SET accolade_id = NULL WHERE id = ANY(v_stamps);

  -- ── Leaf blockers first (deepest). ───────────────────────────────────────
  DELETE FROM public.mood_ratings           WHERE stamp_id = ANY(v_stamps);
  DELETE FROM public.reading_recommendations WHERE stamp_id = ANY(v_stamps);
  DELETE FROM public.accolades              WHERE stamp_id = ANY(v_stamps) OR stop_id = ANY(v_stops);
  DELETE FROM public.teacher_notes          WHERE journal_entry_id = ANY(v_journals) OR stop_id = ANY(v_stops);
  DELETE FROM public.journal_sharing_terms  WHERE journey_id = ANY(v_journeys);
  DELETE FROM public.presence_sessions      WHERE stop_id = ANY(v_stops);
  DELETE FROM public.prize_configurations   WHERE page_id = ANY(v_pages);
  DELETE FROM public.redemption_tokens      WHERE page_id = ANY(v_pages);
  DELETE FROM public.punches                WHERE card_instance_id = ANY(v_cards) OR stop_id = ANY(v_stops);

  -- ── Mid level. ───────────────────────────────────────────────────────────
  DELETE FROM public.journal_entries WHERE id = ANY(v_journals);  -- cascades journal_photos
  DELETE FROM public.journeys        WHERE id = ANY(v_journeys);  -- cascades journey_members
  DELETE FROM public.stamps          WHERE id = ANY(v_stamps);
  DELETE FROM public.card_instances  WHERE id = ANY(v_cards);     -- cascades any remaining punches
  DELETE FROM public.collector_passports WHERE passport_id = p_passport_id;
  DELETE FROM public.acquisitions    WHERE passport_id = p_passport_id;

  -- ── Erase the lifetime ownership trace ("as if never owned"). The ledger
  --    has no FK (it is built to outlive a purge), so this is an explicit
  --    choice unique to the force path. Safe: nothing reads a deleted
  --    passport's ledger rows again. ─────────────────────────────────────────
  DELETE FROM public.passport_acquisition_ledger WHERE passport_id = p_passport_id;
  GET DIAGNOSTICS v_ledger_erased = ROW_COUNT;

  -- ── Remaining direct passport blockers. ──────────────────────────────────
  DELETE FROM public.completion_tokens      WHERE passport_id = p_passport_id OR page_id = ANY(v_pages);
  DELETE FROM public.creator_quality_scores WHERE passport_id = p_passport_id;
  DELETE FROM public.print_jobs             WHERE passport_id = p_passport_id;
  DELETE FROM public.tips                   WHERE passport_id = p_passport_id;

  -- ── The passport. Cascades pages→stops/elements, snapshots, autosaves,
  --    invite_tokens, transfers, republish_log, admin_inspection_log. If any
  --    blocker survives the explicit deletes above, THIS raises and the whole
  --    function rolls back (fail-closed). ────────────────────────────────────
  DELETE FROM public.passports WHERE id = p_passport_id;

  -- ── Exclusive-asset cleanup (fail-safe; never blocks the purge). ─────────
  FOR v_asset IN SELECT asset_id, asset_url FROM _fp_assets LOOP
    BEGIN
      SELECT public.count_asset_references(v_asset.asset_id, COALESCE(v_asset.asset_url, '')) INTO v_refs;
      IF v_refs = 0 THEN
        DELETE FROM public.design_assets WHERE id = v_asset.asset_id;
        v_assets_deleted := v_assets_deleted + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- uncertainty → preserve the asset; the orphan sweep revisits later.
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'force_purged', true,
    'passport_id', p_passport_id,
    'title', v_title,
    'holders_removed', v_holders,
    'stamps_removed', COALESCE(array_length(v_stamps, 1), 0),
    'ledger_rows_erased', v_ledger_erased,
    'assets_deleted', v_assets_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.force_purge_passport(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_purge_passport(uuid) TO authenticated;
