-- 111_passport_collections.sql
--
-- Passport collections: group related passports (e.g. "Gluten-Free America",
-- one passport per state) with collection-level reward badges for completing N
-- or all of them. Each passport stays fully independent — acquired, stamped and
-- completed on its own. This migration adds the data model, RLS, and the badge
-- award path. NO change to how passports are acquired/stamped/completed.
--
-- DESIGN (approved judgment calls):
--   * Progress is DERIVED (count of the collector's completed collector_passports
--     whose passport is a PUBLISHED member) — no progress table.
--   * A passport counts toward a collection when its collector_passports.completed_at
--     is set (the passport's own completion rule — threshold or 100%); that column
--     is written in exactly one place (complete_passport, migration 106).
--   * Rewards are awarded by a trigger on collector_passports (AFTER UPDATE OF
--     completed_at), so both completion paths (explicit complete_passport and the
--     100% auto path) fire it once, without rewriting the large complete_passport
--     SECURITY DEFINER function.
--   * 'all' = every PUBLISHED passport currently in the collection; a badge once
--     earned is never revoked (ON CONFLICT DO NOTHING + no delete).
--   * Draft members are owner-only and excluded from collector counts.
--   * A collection may contain only passports the owner owns, unless the owner is
--     a platform admin (okuji-official collections can mix creators).
--   * Pricing stays per-passport. edition_label is display-only.
--
-- Follows the 078 creator-owns RLS shape and the 108 collector_badges award
-- pattern (caller guard + app.awarding_badge flag + ON CONFLICT DO NOTHING).

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passport_collections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES public.profiles(id),
  institution_id    uuid REFERENCES public.institutions(id),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  subtitle          text,
  description       text,
  cover_asset_id    uuid REFERENCES public.design_assets(id),
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','archived')),
  is_okuji_official boolean NOT NULL DEFAULT false,
  edition_label     text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.passport_collection_items (
  collection_id uuid NOT NULL REFERENCES public.passport_collections(id) ON DELETE CASCADE,
  passport_id   uuid NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, passport_id)
);
CREATE INDEX IF NOT EXISTS idx_pci_passport ON public.passport_collection_items(passport_id);

CREATE TABLE IF NOT EXISTS public.passport_collection_rewards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  uuid NOT NULL REFERENCES public.passport_collections(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('count','all')),
  required_count integer
                   CHECK (
                     (kind = 'count' AND required_count IS NOT NULL AND required_count > 0)
                     OR (kind = 'all' AND required_count IS NULL)
                   ),
  -- badge_key is the idempotency key written to collector_badges; globally unique
  -- so two rewards can never collide on one collector (collector_badges is
  -- UNIQUE(user_id, badge_key)). The okujiKobo editor generates it.
  badge_key      text NOT NULL UNIQUE,
  title          text NOT NULL,
  description    text,
  badge_asset_id uuid REFERENCES public.design_assets(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcr_collection ON public.passport_collection_rewards(collection_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.passport_collections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_collection_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_collection_rewards ENABLE ROW LEVEL SECURITY;

-- Owner (or platform admin, or a can_design employee of the owning institution)
-- manages the collection. Mirrors the 078 passports_creator policy.
DROP POLICY IF EXISTS "collections_owner" ON public.passport_collections;
CREATE POLICY "collections_owner" ON public.passport_collections
  FOR ALL USING (
    owner_id = (select auth.uid())
    OR (select public.is_platform_admin())
    OR (institution_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.employee_authorizations ea
           WHERE ea.user_id = (select auth.uid())
             AND ea.institution_id = passport_collections.institution_id
             AND ea.can_design = true))
  );

-- Collectors read PUBLISHED collections, plus ARCHIVED ones they earned a badge
-- from (archived stays visible to badge-holders, hidden from discovery via the
-- status='published' filter in queries).
DROP POLICY IF EXISTS "collections_read_public" ON public.passport_collections;
CREATE POLICY "collections_read_public" ON public.passport_collections
  FOR SELECT USING (
    status = 'published'
    OR owner_id = (select auth.uid())
    OR (select public.is_platform_admin())
    OR EXISTS (
         SELECT 1 FROM public.collector_badges cb
          WHERE cb.user_id = (select auth.uid())
            AND cb.metadata->>'collection_id' = passport_collections.id::text)
  );

-- Items: readable when the parent collection is readable; writable only by the
-- collection owner/admin AND (on insert) only for passports the owner owns
-- (unless platform admin — official collections can mix creators).
DROP POLICY IF EXISTS "collection_items_read" ON public.passport_collection_items;
CREATE POLICY "collection_items_read" ON public.passport_collection_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.passport_collections c
             WHERE c.id = collection_id
               AND (c.status = 'published'
                    OR c.owner_id = (select auth.uid())
                    OR (select public.is_platform_admin())))
  );

DROP POLICY IF EXISTS "collection_items_write" ON public.passport_collection_items;
CREATE POLICY "collection_items_write" ON public.passport_collection_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.passport_collections c
             WHERE c.id = collection_id
               AND (c.owner_id = (select auth.uid()) OR (select public.is_platform_admin())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.passport_collections c
             WHERE c.id = collection_id
               AND (c.owner_id = (select auth.uid()) OR (select public.is_platform_admin())))
    AND (
      (select public.is_platform_admin())
      OR EXISTS (SELECT 1 FROM public.passports p
                  WHERE p.id = passport_id AND p.creator_id = (select auth.uid()))
    )
  );

-- Rewards: readable with the collection; writable by owner/admin.
DROP POLICY IF EXISTS "collection_rewards_read" ON public.passport_collection_rewards;
CREATE POLICY "collection_rewards_read" ON public.passport_collection_rewards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.passport_collections c
             WHERE c.id = collection_id
               AND (c.status = 'published'
                    OR c.owner_id = (select auth.uid())
                    OR (select public.is_platform_admin())))
  );

DROP POLICY IF EXISTS "collection_rewards_write" ON public.passport_collection_rewards;
CREATE POLICY "collection_rewards_write" ON public.passport_collection_rewards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.passport_collections c
             WHERE c.id = collection_id
               AND (c.owner_id = (select auth.uid()) OR (select public.is_platform_admin())))
  );

-- ── is_okuji_official admin-write guard (mirrors 105/107) ────────────────────
CREATE OR REPLACE FUNCTION public.guard_collections_is_okuji_official()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_okuji_official, false) = true
       AND auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passport_collections.is_okuji_official may only be set by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_okuji_official IS DISTINCT FROM OLD.is_okuji_official
       AND auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'passport_collections.is_okuji_official may only be changed by a platform admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_collections_is_okuji_official ON public.passport_collections;
CREATE TRIGGER trg_guard_collections_is_okuji_official
  BEFORE INSERT OR UPDATE ON public.passport_collections
  FOR EACH ROW EXECUTE FUNCTION public.guard_collections_is_okuji_official();

-- ── Reward awarding (108 pattern) ────────────────────────────────────────────
-- Internal: evaluate ONE collection's rewards for a collector and insert any
-- newly-met badges. No caller guard (callers below guard). Published members
-- only; 'all' = every published member currently in the collection.
CREATE OR REPLACE FUNCTION public._award_one_collection(p_user_id uuid, p_collection_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_done     integer;
  v_total    integer;
  v_awarded  integer := 0;
  r          record;
BEGIN
  -- Completed, PUBLISHED members this collector holds.
  SELECT count(*) INTO v_done
    FROM public.passport_collection_items i
    JOIN public.passports p ON p.id = i.passport_id AND p.is_published = true
    JOIN public.collector_passports cp
      ON cp.passport_id = i.passport_id
     AND cp.user_id = p_user_id
     AND cp.completed_at IS NOT NULL
   WHERE i.collection_id = p_collection_id;

  -- Published-member denominator (for 'all').
  SELECT count(*) INTO v_total
    FROM public.passport_collection_items i
    JOIN public.passports p ON p.id = i.passport_id AND p.is_published = true
   WHERE i.collection_id = p_collection_id;

  FOR r IN
    SELECT id, kind, required_count, badge_key, title, description
      FROM public.passport_collection_rewards
     WHERE collection_id = p_collection_id
  LOOP
    IF (r.kind = 'count' AND v_done >= r.required_count)
       OR (r.kind = 'all' AND v_total > 0 AND v_done >= v_total) THEN
      PERFORM set_config('app.awarding_badge', '1', true);
      INSERT INTO public.collector_badges (user_id, badge_key, metadata)
      VALUES (
        p_user_id, r.badge_key,
        jsonb_build_object(
          'collection_id', p_collection_id,
          'reward_id', r.id,
          'title', r.title,
          'description', r.description,
          'source', 'collection'
        )
      )
      ON CONFLICT (user_id, badge_key) DO NOTHING;
      IF FOUND THEN v_awarded := v_awarded + 1; END IF;
    END IF;
  END LOOP;

  RETURN v_awarded;
END;
$$;

-- Public: award across every collection containing p_passport_id. Caller guard
-- mirrors award_demo_completion_badge — a client may only award for itself;
-- service role / platform admin unrestricted.
CREATE OR REPLACE FUNCTION public.award_collection_rewards(p_user_id uuid, p_passport_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_total integer := 0; c record;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized to award collection badges for another user'
      USING ERRCODE = '42501';
  END IF;
  FOR c IN
    SELECT collection_id FROM public.passport_collection_items WHERE passport_id = p_passport_id
  LOOP
    v_total := v_total + public._award_one_collection(p_user_id, c.collection_id);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.award_collection_rewards(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_collection_rewards(uuid, uuid) TO authenticated, service_role;

-- Admin-only backfill for one collection: award to everyone who already
-- qualifies. NOT run automatically.
CREATE OR REPLACE FUNCTION public.backfill_collection_rewards(p_collection_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_total integer := 0; u record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'backfill_collection_rewards is platform-admin only'
      USING ERRCODE = '42501';
  END IF;
  FOR u IN
    SELECT DISTINCT cp.user_id
      FROM public.passport_collection_items i
      JOIN public.passports p ON p.id = i.passport_id AND p.is_published = true
      JOIN public.collector_passports cp
        ON cp.passport_id = i.passport_id AND cp.completed_at IS NOT NULL
     WHERE i.collection_id = p_collection_id
  LOOP
    v_total := v_total + public._award_one_collection(u.user_id, p_collection_id);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_collection_rewards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_collection_rewards(uuid) TO service_role;

-- ── Fire awards when a passport is recorded complete ─────────────────────────
-- completed_at is written only by complete_passport (migration 106); this
-- AFTER UPDATE trigger catches the NULL -> set transition for BOTH the explicit
-- and 100%-auto completion paths without rewriting that function.
CREATE OR REPLACE FUNCTION public.on_collector_passport_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.award_collection_rewards(NEW.user_id, NEW.passport_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_collection_rewards ON public.collector_passports;
CREATE TRIGGER trg_award_collection_rewards
  AFTER UPDATE OF completed_at ON public.collector_passports
  FOR EACH ROW EXECUTE FUNCTION public.on_collector_passport_completed();
