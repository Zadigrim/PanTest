-- Migration 026: Enable RLS on institutions table.
--
-- The institutions table was created directly in the Supabase dashboard and
-- never had ENABLE ROW LEVEL SECURITY run on it.  Policies were created in
-- 014_blockpoint6 but had no effect because RLS was off — the table was
-- fully public.
--
-- Access model:
--   SELECT — any request (public, like proprietors; institution names appear
--             on published passport pages visible to collectors).
--   ALL     — platform admins, or the institution's own auth user
--             (institutions.id = auth.uid()), per 014_blockpoint6.

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Public read: institution names and metadata are non-sensitive and needed
-- by collectors viewing passports, the marketplace, and the print-PDF route.
CREATE POLICY "institutions_public_read" ON public.institutions
  FOR SELECT USING (true);
