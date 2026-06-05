-- Migration 063: passport_published_snapshots
--
-- Snapshots the published state of a passport at every
-- publish + republish call. Used by the republish correction
-- gate (lib/design/republish/diff.ts) to detect what changed
-- between the previous published state and the current draft.
--
-- WHY a separate table instead of diffing live rows?
--   * The publish flow OVERWRITES the live passports /
--     passport_pages / stops rows. Once a creator unpublishes
--     and starts editing, the previous published state is
--     gone — no rollback target without a snapshot.
--   * Holders RENDER the live rows (spec invariant). The
--     snapshot is NOT for serving content — it's purely the
--     diff target.
--   * One JSON blob per publish event is tiny relative to
--     acquisitions traffic. We don't need a row-versioned
--     table or column-level history.
--
-- Snapshot shape (in `snapshot` jsonb):
--   {
--     "passport": { id, title, description, price_cents,
--                   expected_spend_tier, cover_image_url, ... },
--     "pages":    [ { id, page_order, title, ... } ],
--     "stops":    [ { id, page_id, name, lat, lng,
--                     address_*, experience_type,
--                     experience_verification_method,
--                     verification_tier,
--                     verification_radius_meters,
--                     qr_code_token, closed_at,
--                     learning_objective, journal_prompt,
--                     name, ... } ]
--   }
-- The application captures these fields; we don't enforce
-- the schema at the DB layer because the diff code is the
-- only consumer and a missing field is treated as null on
-- the snapshot side (= a real edit, classified accordingly).
--
-- Indexed by (passport_id, published_at DESC) so the diff
-- always reads the LATEST snapshot in O(log n).

CREATE TABLE IF NOT EXISTS public.passport_published_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id   uuid        NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  published_at  timestamptz NOT NULL DEFAULT now(),
  published_by  uuid        NULL REFERENCES public.profiles(id),
  snapshot      jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS passport_published_snapshots_latest_idx
  ON public.passport_published_snapshots (passport_id, published_at DESC);

ALTER TABLE public.passport_published_snapshots ENABLE ROW LEVEL SECURITY;

-- SELECT: passport creator + platform admin. Holders never
-- need to read snapshots (they read live rows); the gate
-- doesn't surface diff details to the public.
DROP POLICY IF EXISTS "snapshots_read" ON public.passport_published_snapshots;
CREATE POLICY "snapshots_read" ON public.passport_published_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.is_platform_admin = true
    )
  );

-- INSERT: ONLY via SECURITY DEFINER routes
-- (/api/passports/:id/republish + /api/passports/:id/publish-hook
-- — TODO when the publish-hook lands). Direct writes are
-- not allowed; the WITH CHECK = false makes that explicit.
-- Until the publish flow is hooked up to write here, the
-- republish route writes snapshots service-side bypassing
-- RLS via the server-key client.
DROP POLICY IF EXISTS "snapshots_insert" ON public.passport_published_snapshots;
CREATE POLICY "snapshots_insert" ON public.passport_published_snapshots
  FOR INSERT
  WITH CHECK (false);
