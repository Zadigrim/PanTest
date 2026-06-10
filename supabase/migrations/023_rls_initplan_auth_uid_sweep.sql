-- Migration 023: InitPlan-wrap auth.uid() across mobile-schema RLS policies
--
-- The Supabase database advisor flags every RLS policy that calls
-- auth.uid() bare in a USING / WITH CHECK clause: it's planned as a
-- per-row expression and re-evaluated for each candidate row. Wrapping
-- it in a scalar subquery — (select auth.uid()) — lets the planner hoist
-- it to a single InitPlan evaluated once per statement.
--
-- Sweep companion to migration 022 (which did passports_read_published
-- alone) and the web-side migration 078. Every policy below is recreated
-- with its EXACT current logic — same USING, same WITH CHECK, same
-- roles, same commands — with only auth.uid() rewritten to
-- (select auth.uid()). No access semantics change; the mobile client
-- needs no change and no new binary. Planner-only.
--
-- Notes on what's reproduced and what's skipped:
--   * pages_read / stops_read use the broadened forms from migration 010
--     (existing-collector read after unpublish), NOT the 001 originals.
--   * passports_read_published is already handled by migration 022 — not
--     repeated here.
--   * Policies with no auth.uid() are untouched: proprietors_read (true),
--     stamp_slots_public_read (is_published), stop_qr_tokens_admin_only
--     (is_admin only).
--   * is_admin() is left as-is — it's a STABLE function (migration 076),
--     not an auth.* call the advisor targets.
--
-- ROLLBACK: recreate each policy with the bare auth.uid() form from its
-- source migration (001 / 003 / 004 / 005 / 010 / 014 / 018).

-- ── profiles (001) ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING ((select auth.uid()) = id);

-- ── passports (001) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "passports_creator_manage" ON public.passports;
CREATE POLICY "passports_creator_manage" ON public.passports
  FOR ALL USING (creator_id = (select auth.uid()));

-- ── passport_pages ────────────────────────────────────────────────────
-- pages_read: live (broadened) form from migration 010.
DROP POLICY IF EXISTS "pages_read" ON public.passport_pages;
CREATE POLICY "pages_read" ON public.passport_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id
        AND (
          p.is_published = true
          OR p.creator_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.collector_passports cp
            WHERE cp.passport_id = p.id AND cp.user_id = (select auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.acquisitions a
            WHERE a.passport_id = p.id AND a.user_id = (select auth.uid())
          )
        )
    )
  );
DROP POLICY IF EXISTS "pages_creator_manage" ON public.passport_pages;
CREATE POLICY "pages_creator_manage" ON public.passport_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id AND p.creator_id = (select auth.uid())
    )
  );

-- ── stops ─────────────────────────────────────────────────────────────
-- stops_read: live (broadened) form from migration 010.
DROP POLICY IF EXISTS "stops_read" ON public.stops;
CREATE POLICY "stops_read" ON public.stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id
        AND (
          p.is_published = true
          OR p.creator_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.collector_passports cp
            WHERE cp.passport_id = p.id AND cp.user_id = (select auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.acquisitions a
            WHERE a.passport_id = p.id AND a.user_id = (select auth.uid())
          )
        )
    )
  );
DROP POLICY IF EXISTS "stops_creator_manage" ON public.stops;
CREATE POLICY "stops_creator_manage" ON public.stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id AND p.creator_id = (select auth.uid())
    )
  );

-- ── collector_passports (001) ─────────────────────────────────────────
DROP POLICY IF EXISTS "collector_passports_own" ON public.collector_passports;
CREATE POLICY "collector_passports_own" ON public.collector_passports
  FOR ALL USING (user_id = (select auth.uid()));

-- ── stamps (001) ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stamps_own" ON public.stamps;
CREATE POLICY "stamps_own" ON public.stamps
  FOR ALL USING (user_id = (select auth.uid()));

-- ── journal_entries (001) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "journal_own" ON public.journal_entries;
CREATE POLICY "journal_own" ON public.journal_entries
  FOR ALL USING (user_id = (select auth.uid()));

-- ── redemption_tokens (001) ───────────────────────────────────────────
DROP POLICY IF EXISTS "tokens_own" ON public.redemption_tokens;
CREATE POLICY "tokens_own" ON public.redemption_tokens
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.employee_accounts ea
      WHERE ea.user_id = (select auth.uid())
      AND ea.is_active = true
    )
  );
DROP POLICY IF EXISTS "tokens_user_insert" ON public.redemption_tokens;
CREATE POLICY "tokens_user_insert" ON public.redemption_tokens
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "tokens_employee_update" ON public.redemption_tokens;
CREATE POLICY "tokens_employee_update" ON public.redemption_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.employee_accounts ea
      WHERE ea.user_id = (select auth.uid())
      AND ea.is_active = true
    )
  );

-- ── employee_accounts (001) ───────────────────────────────────────────
DROP POLICY IF EXISTS "employee_own" ON public.employee_accounts;
CREATE POLICY "employee_own" ON public.employee_accounts
  FOR SELECT USING (user_id = (select auth.uid()));

-- ── accolades (003) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "accolades_collector_or_giver" ON public.accolades;
CREATE POLICY "accolades_collector_or_giver" ON public.accolades
  FOR ALL USING (
    user_id   = (select auth.uid()) OR
    given_by  = (select auth.uid())
  );

-- ── reading_recommendations (003) ─────────────────────────────────────
DROP POLICY IF EXISTS "reading_rec_collector_or_librarian" ON public.reading_recommendations;
CREATE POLICY "reading_rec_collector_or_librarian" ON public.reading_recommendations
  FOR ALL USING (
    user_id        = (select auth.uid()) OR
    recommended_by = (select auth.uid())
  );

-- ── teacher_notes (003) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_notes_student_or_teacher" ON public.teacher_notes;
CREATE POLICY "teacher_notes_student_or_teacher" ON public.teacher_notes
  FOR ALL USING (
    student_user_id = (select auth.uid()) OR
    teacher_user_id = (select auth.uid())
  );

-- ── stamp_slots (004) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "stamp_slots_creator" ON public.stamp_slots;
CREATE POLICY "stamp_slots_creator" ON public.stamp_slots
  FOR ALL USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.creator_id = (select auth.uid())
    )
  );

-- ── journal photos: storage.objects (005) ─────────────────────────────
DROP POLICY IF EXISTS "journal_photos_insert" ON storage.objects;
CREATE POLICY "journal_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
DROP POLICY IF EXISTS "journal_photos_select" ON storage.objects;
CREATE POLICY "journal_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
DROP POLICY IF EXISTS "journal_photos_delete" ON storage.objects;
CREATE POLICY "journal_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── journal_photos table (005) ────────────────────────────────────────
DROP POLICY IF EXISTS "journal_photos_own" ON public.journal_photos;
CREATE POLICY "journal_photos_own" ON public.journal_photos
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── card_instances (014) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "card_instances_own_read" ON public.card_instances;
CREATE POLICY "card_instances_own_read" ON public.card_instances
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.collector_passports cp
      WHERE cp.id = card_instances.collector_passport_id
        AND cp.user_id = (select auth.uid())
    )
  );
DROP POLICY IF EXISTS "card_instances_employee_read" ON public.card_instances;
CREATE POLICY "card_instances_employee_read" ON public.card_instances
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1
      FROM public.collector_passports cp
      JOIN public.passports p ON p.id = cp.passport_id
      JOIN public.employee_authorizations ea ON ea.institution_id = p.proprietor_id
      WHERE cp.id = card_instances.collector_passport_id
        AND ea.user_id = (select auth.uid())
        AND ea.can_verify = true
    )
  );

-- ── punches (018) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "punches_own_read" ON public.punches;
CREATE POLICY "punches_own_read" ON public.punches
  FOR SELECT
  USING (
    public.is_admin() = true
    OR user_id = (select auth.uid())
  );
DROP POLICY IF EXISTS "punches_employee_read" ON public.punches;
CREATE POLICY "punches_employee_read" ON public.punches
  FOR SELECT
  USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1
      FROM public.card_instances ci
      JOIN public.collector_passports cp ON cp.id = ci.collector_passport_id
      JOIN public.passports p ON p.id = cp.passport_id
      JOIN public.employee_authorizations ea ON ea.institution_id = p.proprietor_id
      WHERE ci.id = punches.card_instance_id
        AND ea.user_id = (select auth.uid())
        AND ea.can_verify = true
    )
  );
