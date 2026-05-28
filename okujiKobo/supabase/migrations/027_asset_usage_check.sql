-- count_asset_references: atomic safety check for hard-deleting a design_assets row.
--
-- Returns the number of times an asset is referenced anywhere — across BOTH
-- draft and published passports. Deletion is only safe when this returns 0.
--
-- Reference locations covered (all four asset surfaces):
--   1. passport_pages.background_image_url (text, migration 019)
--   2. passport_pages.elements JSONB array — image elements with imageUrl
--      (migration 017)
--   3. stops.stamp_asset_id (uuid FK to design_assets, migration 012)
--   4. passports.cover_image_url (legacy text column, migration 002)
--   5. passports.cover_outside_data and cover_inside_data JSONB — image_url
--      key, and elements[].imageUrl (migration 007)
--
-- JSONB matches wrap the URL in JSON-string quotes ("…") so a URL that is a
-- substring of another (e.g. "100.png" inside "9100.png") cannot produce a
-- false positive. Direct text columns use equality.
--
-- SECURITY DEFINER so callers don't need SELECT on every table; the deletion
-- API route's auth check upstream is what gates whose assets can be removed.

CREATE OR REPLACE FUNCTION public.count_asset_references(
  p_asset_id  uuid,
  p_asset_url text
) RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT count(*) FROM public.passport_pages
              WHERE background_image_url = p_asset_url), 0)
    +
    COALESCE((SELECT count(*) FROM public.passport_pages
              WHERE elements::text LIKE '%"' || p_asset_url || '"%'), 0)
    +
    COALESCE((SELECT count(*) FROM public.stops
              WHERE stamp_asset_id = p_asset_id), 0)
    +
    COALESCE((SELECT count(*) FROM public.passports
              WHERE cover_image_url = p_asset_url), 0)
    +
    COALESCE((SELECT count(*) FROM public.passports
              WHERE cover_outside_data::text LIKE '%"' || p_asset_url || '"%'
                 OR cover_inside_data::text  LIKE '%"' || p_asset_url || '"%'), 0)
$$;

GRANT EXECUTE ON FUNCTION public.count_asset_references(uuid, text) TO authenticated;
