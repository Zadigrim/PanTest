-- Migration 096: fix force_purge_passport for live-schema drift.
--
-- 094/095 were built from the migration files, but the live DB has drifted
-- from them (see the earlier "Reconcile 002-vs-live schema drift" work).
-- Two references didn't match live and aborted the purge with
-- "column passport_id does not exist":
--
--   1. journal_entries — the migration files declare passport_id (+ stop_id),
--      but in live the table links to the passport ONLY via stamp_id. The
--      journal set is now scoped by stamp_id alone (still complete: v_stamps
--      already captures every stamp of the passport, and journals hang off
--      stamps).
--   2. redemption_tokens — declared in the mobile 001 migration but NOT
--      present in the live schema. Guarded with to_regclass so the delete is
--      a no-op when the table is absent (and works if it ever reappears).
--
-- Verified every other table.column the function touches against the
-- live-derived types; these two were the only mismatches. Self-contained
-- CREATE OR REPLACE (supersedes 095); depends only on 085 helpers.
--
-- ROLLBACK: re-apply 095. Additive; modifies no existing row.

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

  -- ── Resolve every passport-scoped id set up front. ───────────────────────
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
  -- journal_entries links to the passport ONLY via stamp_id in live (no
  -- passport_id / stop_id columns). v_stamps is the full stamp set, so this
  -- captures every journal for the passport.
  SELECT COALESCE(array_agg(id), '{}') INTO v_journals
    FROM public.journal_entries WHERE stamp_id = ANY(v_stamps);
  SELECT COALESCE(array_agg(id), '{}') INTO v_journeys
    FROM public.journeys WHERE passport_id = p_passport_id;

  v_holders := COALESCE(array_length(v_cp, 1), 0);

  -- ── Exclusive-asset candidates (mirrors retention_purge). ────────────────
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

  -- ── Audit BEFORE the delete. ─────────────────────────────────────────────
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
  -- redemption_tokens is absent in the live schema; guard so this is a no-op
  -- when the table doesn't exist (and still works if it's ever added).
  IF to_regclass('public.redemption_tokens') IS NOT NULL THEN
    DELETE FROM public.redemption_tokens    WHERE page_id = ANY(v_pages);
  END IF;
  DELETE FROM public.punches                WHERE card_instance_id = ANY(v_cards) OR stop_id = ANY(v_stops);

  -- ── Mid level. ───────────────────────────────────────────────────────────
  DELETE FROM public.journal_entries WHERE id = ANY(v_journals);  -- cascades journal_photos
  DELETE FROM public.journeys        WHERE id = ANY(v_journeys);  -- cascades journey_members
  DELETE FROM public.stamps          WHERE id = ANY(v_stamps);
  DELETE FROM public.card_instances  WHERE id = ANY(v_cards);     -- cascades any remaining punches
  DELETE FROM public.collector_passports WHERE passport_id = p_passport_id;
  DELETE FROM public.acquisitions    WHERE passport_id = p_passport_id;

  -- ── Erase the lifetime ownership trace ("as if never owned"). ────────────
  DELETE FROM public.passport_acquisition_ledger WHERE passport_id = p_passport_id;
  GET DIAGNOSTICS v_ledger_erased = ROW_COUNT;

  -- ── Remaining direct passport blockers. ──────────────────────────────────
  DELETE FROM public.completion_tokens      WHERE passport_id = p_passport_id OR page_id = ANY(v_pages);
  DELETE FROM public.creator_quality_scores WHERE passport_id = p_passport_id;
  DELETE FROM public.print_jobs             WHERE passport_id = p_passport_id;
  DELETE FROM public.tips                   WHERE passport_id = p_passport_id;

  -- ── The passport (cascades the design subtree). Fail-closed: any unmapped
  --    blocker raises here and rolls back the whole purge. ──────────────────
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
      NULL;
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
