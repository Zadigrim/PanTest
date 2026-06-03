-- Published-passport page images.
--
-- Explore shows pre-rendered images of each page (and the front cover)
-- instead of live-rendering the React tree. Generation happens
-- client-side in the publisher's browser at publish time — see
-- lib/explore/publish-images.ts — and uploads to the new
-- `passport-pages` bucket. The URLs land here; null until the
-- passport has been published at least once with the new mechanism.
--
-- cover_image_url   single front-cover PNG (rightmost 612×792 crop)
-- page_image_urls   jsonb array of PNG URLs, indexed by page_order so
--                   the Explore viewer can walk them as a sequence
--
-- Republish overwrites in place — both the storage objects (same
-- paths, upsert=true) and these columns — so images never go stale.
-- Cache busting on the URL is handled by appending ?v=<published_at>
-- at viewer time.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS page_image_urls jsonb;

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- Public bucket so the Explore viewer can fetch images without auth.
-- Path convention enforced by client code:
--   {passport_id}/cover.png
--   {passport_id}/page-{order}.png

INSERT INTO storage.buckets (id, name, public)
VALUES ('passport-pages', 'passport-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Public read so /explore/[id] can <img src=…> the URLs directly.
DROP POLICY IF EXISTS "passport_pages_read" ON storage.objects;
CREATE POLICY "passport_pages_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'passport-pages');

-- Authenticated writes. We don't constrain the folder name here
-- because it would require a function call to check passports
-- ownership; the publish-images path on the client constructs the
-- folder from the passport id the user just published, and the
-- passports RLS already gates whether they could publish in the
-- first place.
DROP POLICY IF EXISTS "passport_pages_upload" ON storage.objects;
CREATE POLICY "passport_pages_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'passport-pages');

DROP POLICY IF EXISTS "passport_pages_update" ON storage.objects;
CREATE POLICY "passport_pages_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'passport-pages');

DROP POLICY IF EXISTS "passport_pages_delete" ON storage.objects;
CREATE POLICY "passport_pages_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'passport-pages');
