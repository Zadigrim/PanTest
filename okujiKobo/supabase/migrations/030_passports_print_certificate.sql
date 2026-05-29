-- Add passports.print_certificate to allow non-K-12 passports to opt in
-- (or K-12 passports to opt out of) the auto-generated completion certificate
-- on the printed booklet.
--
-- Auto-detection logic in the print pipeline:
--   • passport.passport_type = 'learning'           → certificate auto-on
--   • institution.institution_type ∈ K-12 set       → certificate auto-on
--   • otherwise                                      → certificate off by default
--
-- This column is the override:
--   • NULL  → use auto-detect
--   • TRUE  → always include certificate
--   • FALSE → always omit certificate, even for K-12
--
-- The default is NULL so existing passports get auto-detect behavior with no
-- visible change. Designer UI can later expose this as a tri-state toggle.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS print_certificate boolean;

COMMENT ON COLUMN public.passports.print_certificate IS
  'Override for the printed booklet completion-certificate page. '
  'NULL = auto-detect from passport_type and institution_type; '
  'TRUE = always include; FALSE = always omit.';
