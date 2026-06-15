-- 088_passport_spec_cover_spine.sql
--
-- The passport artboard was resized to the real US/ISO passport spec
-- (ISO/IEC 7810 ID-3): a page is now 88×125 mm → 612×869 design units
-- (anchored at width 612, height grown 792→869), and the cover wrap is
-- 1252×869 with a 28px (≈4 mm) spine so back+spine+front ≈ 180 mm.
-- See lib/explore/svg/PageSvg.tsx and components/design/CoverCanvas.tsx.
--
-- The ONLY stored coordinates that need adjusting are COVER element
-- x-positions. The spine widened 24→28, moving the front panel's left
-- edge from x=636 to x=640, so front-panel elements shift +4 to keep
-- their position relative to the front panel.
--
-- Deliberately NOT touched:
--   * Page / stop coordinates — the page grew in HEIGHT only, top-anchored,
--     so every existing x/y stays valid (more room at the bottom). No page
--     migration is needed.
--   * Cover element y / width / fontSize — height grew, content is
--     top-anchored; no vertical rescale (keeps the change non-destructive).
--   * image_position_x / image_position_y / image_scale — normalized 0..1
--     fractions; they re-fit the new aspect automatically.
--
-- Mirrors the migration-029 cover-correction x-shift. Back-panel elements
-- (x < 636) and any spine-gutter elements are unchanged. One-shot; the
-- helper function is dropped at the end. Idempotent only if run once — the
-- shift is unconditional for x ≥ 636, so do not re-run.

CREATE OR REPLACE FUNCTION public._cover_elements_spine28(p_elements jsonb) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  el       jsonb;
  out_arr  jsonb := '[]'::jsonb;
  patched  jsonb;
  delta    constant int := 4;    -- spine 24 → 28
  boundary constant int := 636;  -- old front-panel left edge (612 + 24 spine)
  x_cur    numeric;
  x1_cur   numeric;
  x2_cur   numeric;
BEGIN
  IF p_elements IS NULL OR jsonb_typeof(p_elements) <> 'array' THEN
    RETURN p_elements;
  END IF;

  FOR el IN SELECT jsonb_array_elements(p_elements) LOOP
    IF (el->>'type') = 'line' THEN
      x1_cur := COALESCE((el->>'x1')::numeric, 0);
      x2_cur := COALESCE((el->>'x2')::numeric, 0);
      patched := el || jsonb_build_object(
        'x1', round(CASE WHEN x1_cur >= boundary THEN x1_cur + delta ELSE x1_cur END),
        'x2', round(CASE WHEN x2_cur >= boundary THEN x2_cur + delta ELSE x2_cur END)
      );
    ELSE
      x_cur := COALESCE((el->>'x')::numeric, 0);
      patched := el || jsonb_build_object(
        'x', round(CASE WHEN x_cur >= boundary THEN x_cur + delta ELSE x_cur END)
      );
    END IF;

    out_arr := out_arr || jsonb_build_array(patched);
  END LOOP;

  RETURN out_arr;
END;
$$;

UPDATE public.passports
SET cover_outside_data = jsonb_set(
  cover_outside_data,
  '{elements}',
  public._cover_elements_spine28(cover_outside_data->'elements')
)
WHERE cover_outside_data IS NOT NULL
  AND jsonb_typeof(cover_outside_data->'elements') = 'array'
  AND jsonb_array_length(cover_outside_data->'elements') > 0;

UPDATE public.passports
SET cover_inside_data = jsonb_set(
  cover_inside_data,
  '{elements}',
  public._cover_elements_spine28(cover_inside_data->'elements')
)
WHERE cover_inside_data IS NOT NULL
  AND jsonb_typeof(cover_inside_data->'elements') = 'array'
  AND jsonb_array_length(cover_inside_data->'elements') > 0;

DROP FUNCTION public._cover_elements_spine28(jsonb);
