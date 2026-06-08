-- Migration 074: admin_inspection_log — accountability for the admin
-- read-only passport inspection capability
--
-- Web-tree migration. One row per admin opening another creator's
-- passport via the /access/inspect/[id] surface. The log is the
-- accountability that makes the read-grant defensible — if an admin
-- opens content they shouldn't, the trail exists.
--
-- WHAT GETS LOGGED
--   A row is INSERTed by the inspection server-component when ALL
--   of the following hold:
--     * the caller is is_platform_admin = true
--     * the caller is NOT the passport's creator_id
--     * the caller has NO can_design row at the passport's
--       proprietor_id (i.e. inspecting their OWN content via their
--       own employee authorization isn't audit-worthy)
--
--   Self-inspection by the creator, and inspection by an employee
--   with can_design at the institutional owner, both lawfully
--   already have access through normal RLS and don't count as an
--   exceptional event.
--
-- SCHEMA SHAPE — modeled on passport_republish_log (migration 064).
--
--   id                    uuid pk
--   passport_id           uuid fk → passports (cascade on delete)
--   passport_creator_id   uuid fk → profiles (denormalised so a
--                         later DELETE of the passport doesn't
--                         erase WHO owned it at inspection time)
--   inspected_by          uuid fk → profiles
--   inspected_at          timestamptz default now()
--
-- RLS
--   is_platform_admin reads only. INSERT is performed by the
--   inspection route via the user's session (admin's auth.uid).
--   No non-admin path reads or writes this table.
--
-- ROLLBACK: DROP TABLE. The inspection route's INSERT is wrapped
-- in a try/catch on the application side (logs to console on
-- failure rather than blocking the page), so a missing table
-- degrades the inspection UX from "logged" to "unlogged" without
-- breaking it. Don't roll back without owning that gap.

CREATE TABLE IF NOT EXISTS public.admin_inspection_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id         uuid        NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  passport_creator_id uuid        NOT NULL REFERENCES public.profiles(id),
  inspected_by        uuid        NOT NULL REFERENCES public.profiles(id),
  inspected_at        timestamptz NOT NULL DEFAULT now()
);

-- Read paths: by inspector, by passport, recent activity. All small
-- indexes; the table grows slowly (admin inspections are rare).
CREATE INDEX IF NOT EXISTS admin_inspection_log_inspector_idx
  ON public.admin_inspection_log (inspected_by, inspected_at DESC);

CREATE INDEX IF NOT EXISTS admin_inspection_log_passport_idx
  ON public.admin_inspection_log (passport_id, inspected_at DESC);

ALTER TABLE public.admin_inspection_log ENABLE ROW LEVEL SECURITY;

-- is_platform_admin per CLAUDE.md #4 — the canonical platform-admin
-- gate. The RLS uses is_platform_admin specifically (not is_admin)
-- because this is a new surface with no historical reason to
-- inherit the mobile-tree convention.
DROP POLICY IF EXISTS "admin_inspection_log_admin_read" ON public.admin_inspection_log;
CREATE POLICY "admin_inspection_log_admin_read" ON public.admin_inspection_log
  FOR SELECT
  USING (public.is_platform_admin() = true);

DROP POLICY IF EXISTS "admin_inspection_log_admin_insert" ON public.admin_inspection_log;
CREATE POLICY "admin_inspection_log_admin_insert" ON public.admin_inspection_log
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin() = true
    AND inspected_by = auth.uid()
  );

-- No UPDATE / DELETE policies. The log is append-only; an entry
-- written is permanent. Service-role can still clean if needed via
-- direct SQL.
