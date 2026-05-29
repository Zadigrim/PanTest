-- Correct the cover canvas dimensions to match inside pages exactly, with
-- a real 24px spine gutter instead of vertical bleed.
--
-- After migration 028 the canvas was 1224 × 816 (each panel 612 × 816, no
-- spine gap). The intent was for each panel to match an inside page (792
-- tall) and for the 24px slack to live in the spine — but the option was
-- described one way and dimensioned the other. This migration compensates.
--
-- Old (after 028): canvas 1224 × 816, back x ∈ [0, 612), front x ∈ [612, 1224)
-- New (after 029): canvas 1248 × 792, back x ∈ [0, 612), spine x ∈ [612, 636),
--                  front x ∈ [636, 1248)
--
-- Compensation applied to every element in cover_outside_data.elements and
-- cover_inside_data.elements:
--   y, height, y1, y2, fontSize, thickness  : multiplied by 792/816 (≈0.9706)
--   x  (and x1, x2 individually)             : +24 if currently ≥ 612, else unchanged
--   width                                    : no change (panel widths are identical)
--
-- The x rule cleanly separates: back-panel elements stay put; front-panel
-- elements shift right by 24 to land at their new x ≥ 636 home. A line
-- whose endpoints span the spine (x1 < 612, x2 ≥ 612) gets visually
-- lengthened by 24 to bridge the new gutter — that's the right behavior.
--
-- One-shot. Helper function is dropped at the end.

CREATE OR REPLACE FUNCTION public._cover_elements_v2(p_elements jsonb) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  el       jsonb;
  out_arr  jsonb := '[]'::jsonb;
  patched  jsonb;
  sy       constant numeric := 792.0::numeric / 816.0::numeric;
  spine    constant int     := 24;
  boundary constant int     := 612;
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
        'x1', round(CASE WHEN x1_cur >= boundary THEN x1_cur + spine ELSE x1_cur END),
        'y1', round(COALESCE((el->>'y1')::numeric, 0) * sy),
        'x2', round(CASE WHEN x2_cur >= boundary THEN x2_cur + spine ELSE x2_cur END),
        'y2', round(COALESCE((el->>'y2')::numeric, 0) * sy)
      );
      IF el ? 'thickness' THEN
        patched := patched || jsonb_build_object(
          'thickness', GREATEST(1, round(COALESCE((el->>'thickness')::numeric, 1) * sy))
        );
      END IF;
    ELSE
      x_cur := COALESCE((el->>'x')::numeric, 0);
      patched := el || jsonb_build_object(
        'x',      round(CASE WHEN x_cur >= boundary THEN x_cur + spine ELSE x_cur END),
        'y',      round(COALESCE((el->>'y')::numeric, 0) * sy),
        'height', round(COALESCE((el->>'height')::numeric, 0) * sy)
        -- width: no scaling; per-panel width unchanged
      );
      IF el ? 'fontSize' THEN
        patched := patched || jsonb_build_object(
          'fontSize', GREATEST(6, round(COALESCE((el->>'fontSize')::numeric, 14) * sy))
        );
      END IF;
      IF el ? 'thickness' THEN
        patched := patched || jsonb_build_object(
          'thickness', GREATEST(1, round(COALESCE((el->>'thickness')::numeric, 1) * sy))
        );
      END IF;
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
  public._cover_elements_v2(cover_outside_data->'elements')
)
WHERE cover_outside_data IS NOT NULL
  AND jsonb_typeof(cover_outside_data->'elements') = 'array'
  AND jsonb_array_length(cover_outside_data->'elements') > 0;

UPDATE public.passports
SET cover_inside_data = jsonb_set(
  cover_inside_data,
  '{elements}',
  public._cover_elements_v2(cover_inside_data->'elements')
)
WHERE cover_inside_data IS NOT NULL
  AND jsonb_typeof(cover_inside_data->'elements') = 'array'
  AND jsonb_array_length(cover_inside_data->'elements') > 0;

DROP FUNCTION public._cover_elements_v2(jsonb);
