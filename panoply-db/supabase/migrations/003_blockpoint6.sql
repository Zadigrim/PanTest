-- Migration 003: Blockpoint 6 — institution detail fields, admin RLS, cover thumbnail

-- ── 1. Add contact / address fields to institutions ───────────────────────────

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS contact_name   text,
  ADD COLUMN IF NOT EXISTS contact_email  text,
  ADD COLUMN IF NOT EXISTS address_line1  text,
  ADD COLUMN IF NOT EXISTS address_city   text,
  ADD COLUMN IF NOT EXISTS address_state  text,
  ADD COLUMN IF NOT EXISTS address_zip    text,
  ADD COLUMN IF NOT EXISTS website        text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- ── 2. Add cover_thumbnail to passports ──────────────────────────────────────

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS cover_thumbnail text;  -- base64 data-uri or storage URL

-- ── 3. Search / lookup indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS institutions_name_search_idx
  ON public.institutions USING gin(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS institutions_type_idx
  ON public.institutions(institution_type);

CREATE INDEX IF NOT EXISTS institutions_tier_idx
  ON public.institutions(tier);

CREATE INDEX IF NOT EXISTS employee_authorizations_institution_idx
  ON public.employee_authorizations(institution_id);

-- ── 4. Update institutions RLS — platform admins can manage everything ────────

DROP POLICY IF EXISTS "institutions_manager_write" ON public.institutions;

CREATE POLICY "institutions_manager_write" ON public.institutions
  FOR ALL USING (
    public.is_platform_admin() = true
    OR id = auth.uid()
  );

-- Platform admins can read all institutions; others only public read already granted
DROP POLICY IF EXISTS "institutions_admin_read" ON public.institutions;
CREATE POLICY "institutions_admin_read" ON public.institutions
  FOR SELECT USING (
    public.is_platform_admin() = true
  );

-- ── 5. employee_authorizations — managers can read their own institution rows ──

DROP POLICY IF EXISTS "emp_auth_manager_read" ON public.employee_authorizations;
CREATE POLICY "emp_auth_manager_read" ON public.employee_authorizations
  FOR SELECT USING (
    public.is_platform_admin() = true
    OR user_id = auth.uid()
    OR authorized_by = auth.uid()
    OR institution_id IN (
      SELECT id FROM public.institutions WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "emp_auth_manager_write" ON public.employee_authorizations;
CREATE POLICY "emp_auth_manager_write" ON public.employee_authorizations
  FOR INSERT WITH CHECK (
    public.is_platform_admin() = true
    OR institution_id IN (
      SELECT id FROM public.institutions WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "emp_auth_manager_delete" ON public.employee_authorizations;
CREATE POLICY "emp_auth_manager_delete" ON public.employee_authorizations
  FOR DELETE USING (
    public.is_platform_admin() = true
    OR authorized_by = auth.uid()
    OR institution_id IN (
      SELECT id FROM public.institutions WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "emp_auth_self_update" ON public.employee_authorizations;
CREATE POLICY "emp_auth_self_update" ON public.employee_authorizations
  FOR UPDATE USING (
    public.is_platform_admin() = true
    OR authorized_by = auth.uid()
    OR institution_id IN (
      SELECT id FROM public.institutions WHERE id = auth.uid()
    )
  );
