-- 016_print_jobs_nullable_institution.sql
-- Personal (non-institutional) passports have no proprietor_id, so
-- print_jobs.institution_id must allow NULL.

ALTER TABLE public.print_jobs
  ALTER COLUMN institution_id DROP NOT NULL;
