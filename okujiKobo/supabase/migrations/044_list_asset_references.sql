-- list_asset_references: returns the passports + locations that reference an
-- asset, so the /assets management UI can show "Used in N passports" with the
-- specific passport titles, and so a user with an in-use asset knows where to
-- go to remove the reference before deleting.
--
-- Mirrors the surface coverage of count_asset_references (migration 027):
--   1. passport_pages.background_image_url             (text)
--   2. passport_pages.elements jsonb (imageUrl matches) (text LIKE)
--   3. stops.stamp_asset_id                            (uuid FK)
--   4. passports.cover_image_url                       (text)
--   5. passports.cover_outside_data / cover_inside_data jsonb (text LIKE)
--
-- One row per (passport_id, reference_kind) pair. The same passport can appear
-- multiple times if the asset is referenced in distinct surfaces (e.g. on the
-- cover AND a page background). Callers can group by passport_id client-side.

CREATE OR REPLACE FUNCTION public.list_asset_references(
  p_asset_id  uuid,
  p_asset_url text
) RETURNS TABLE (
  passport_id    uuid,
  passport_title text,
  reference_kind text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. Page background
  SELECT DISTINCT p.id, p.title, 'page_background'::text
    FROM public.passport_pages pp
    JOIN public.passports p ON p.id = pp.passport_id
   WHERE pp.background_image_url = p_asset_url

  UNION

  -- 2. Page element (image element in elements jsonb)
  SELECT DISTINCT p.id, p.title, 'page_element'::text
    FROM public.passport_pages pp
    JOIN public.passports p ON p.id = pp.passport_id
   WHERE pp.elements::text LIKE '%"' || p_asset_url || '"%'

  UNION

  -- 3. Stop stamp (FK)
  SELECT DISTINCT p.id, p.title, 'stop_stamp'::text
    FROM public.stops s
    JOIN public.passport_pages pp ON pp.id = s.page_id
    JOIN public.passports p ON p.id = pp.passport_id
   WHERE s.stamp_asset_id = p_asset_id

  UNION

  -- 4. Legacy top-level cover image
  SELECT DISTINCT p.id, p.title, 'cover_image_legacy'::text
    FROM public.passports p
   WHERE p.cover_image_url = p_asset_url

  UNION

  -- 5. Cover side data (image_url + element imageUrl on outside/inside)
  SELECT DISTINCT p.id, p.title, 'cover_data'::text
    FROM public.passports p
   WHERE p.cover_outside_data::text LIKE '%"' || p_asset_url || '"%'
      OR p.cover_inside_data::text  LIKE '%"' || p_asset_url || '"%'
$$;

GRANT EXECUTE ON FUNCTION public.list_asset_references(uuid, text) TO authenticated;
