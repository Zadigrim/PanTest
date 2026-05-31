-- Phase 1, BLD-01..04, FIX-06, DEC-08: capability flag work on
-- employee_authorizations.
--
-- 1. Adds four new capability flag columns:
--      can_design            (BLD-01) — designing under institution's name
--      can_manage_employees  (BLD-02) — replaces institutions.id = auth.uid()
--                                       per DEC-16; the Phase 2 work that
--                                       wires this up at /manage/employees
--                                       and api/employees/lookup gates on it
--      can_view_analytics    (BLD-03) — institution analytics dashboard
--      can_manage_billing    (BLD-04) — subscription / payment / tier UI
--    All four default to FALSE per principle-of-least-privilege.
--
-- 2. Changes existing defaults (FIX-06):
--      can_verify             true -> false
--      can_distribute_prizes  true -> false
--    Only affects FUTURE inserts. Existing rows keep their current values.
--    Audited both INSERT sites (manage/employees, access/institutions);
--    both pass flags explicitly, so no production code path relied on the
--    previous defaults.
--
-- 3. Retires can_add_extras (DEC-08): the capability is folded into
--    can_distribute_prizes. Anyone trusted to distribute prizes is trusted
--    to add extras. Application code updated in companion commits:
--      - okujiKobo/app/api/token/redeem/route.ts   (SEC-03 closure)
--      - okujiKobo/app/api/institutions/[id]/route.ts
--      - okujiKobo/app/(institutional)/terminal/page.tsx
--      - okujiKobo/app/(institutional)/manage/employees/page.tsx
--      - okujiKobo/app/access/institutions/[id]/page.tsx
--      - hooks/useEmployee.ts and types/index.ts
--    The terminal's "Add extras" UI section is now visible whenever the
--    employee can distribute prizes (the same gate as the outcome buttons).
--
-- Phase 1 is schema-only: NONE of the new flags are enforced by application
-- code or RLS in this PR (except can_design, which IS used by 038's RLS
-- expansion on passport-content tables per DEC-18). Phase 2 wires the
-- remaining flags into routes and RLS.

ALTER TABLE public.employee_authorizations
  ADD COLUMN IF NOT EXISTS can_design            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_employees  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_analytics    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_billing    boolean NOT NULL DEFAULT false;

ALTER TABLE public.employee_authorizations
  ALTER COLUMN can_verify            SET DEFAULT false,
  ALTER COLUMN can_distribute_prizes SET DEFAULT false;

ALTER TABLE public.employee_authorizations
  DROP COLUMN IF EXISTS can_add_extras;
