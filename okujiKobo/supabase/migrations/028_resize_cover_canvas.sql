-- Rescale existing passport cover element coordinates after the cover canvas
-- was resized to match the inside-page artboard.
--
-- Old canvas:  560 × 392  (two 280 × 392 panels side-by-side)
-- New canvas: 1224 × 816  (two 612 × 816 panels side-by-side)
--
-- Every text/image/hline/vline element in cover_outside_data.elements and
-- cover_inside_data.elements has x/y/width/height in the old coordinate
-- space. Line elements use x1/y1/x2/y2. This migration scales them so the
-- visual layout stays approximately the same on the larger canvas.
--
-- Coordinate scale factors:
--   x, width, x1, x2  : 1224 / 560 ≈ 2.1857
--   y, height, y1, y2 :  816 / 392 ≈ 2.0816
--
-- Text font sizes and line thicknesses scale by the y factor (text height
-- is what visually matters; using y keeps text legible at roughly the same
-- relative vertical proportion).
--
-- image_position_x / image_position_y / image_scale are normalized 0..1
-- values, not pixels — they do NOT need rescaling.
--
-- This is a one-shot migration. The helper function is dropped at the end.

CREATE OR REPLACE FUNCTION public._rescale_cover_elements_v1(
  p_elements jsonb,
  p_sx       numeric,
  p_sy       numeric
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  el       jsonb;
  out_arr  jsonb := '[]'::jsonb;
  patched  jsonb;
BEGIN
  IF p_elements IS NULL OR jsonb_typeof(p_elements) <> 'array' THEN
    RETURN p_elements;
  END IF;

  FOR el IN SELECT jsonb_array_elements(p_elements) LOOP
    IF (el->>'type') = 'line' THEN
      patched := el || jsonb_build_object(
        'x1', round(COALESCE((el->>'x1')::numeric, 0) * p_sx),
        'y1', round(COALESCE((el->>'y1')::numeric, 0) * p_sy),
        'x2', round(COALESCE((el->>'x2')::numeric, 0) * p_sx),
        'y2', round(COALESCE((el->>'y2')::numeric, 0) * p_sy)
      );
      IF el ? 'thickness' THEN
        patched := patched || jsonb_build_object(
          'thickness', GREATEST(1, round(COALESCE((el->>'thickness')::numeric, 1) * p_sy))
        );
      END IF;
    ELSE
      patched := el || jsonb_build_object(
        'x',      round(COALESCE((el->>'x')::numeric, 0) * p_sx),
        'y',      round(COALESCE((el->>'y')::numeric, 0) * p_sy),
        'width',  round(COALESCE((el->>'width')::numeric, 0) * p_sx),
        'height', round(COALESCE((el->>'height')::numeric, 0) * p_sy)
      );
      IF el ? 'fontSize' THEN
        patched := patched || jsonb_build_object(
          'fontSize', GREATEST(6, round(COALESCE((el->>'fontSize')::numeric, 14) * p_sy))
        );
      END IF;
      IF el ? 'thickness' THEN
        patched := patched || jsonb_build_object(
          'thickness', GREATEST(1, round(COALESCE((el->>'thickness')::numeric, 1) * p_sy))
        );
      END IF;
    END IF;

    out_arr := out_arr || jsonb_build_array(patched);
  END LOOP;

  RETURN out_arr;
END;
$$;

-- Apply to outside-cover element arrays
UPDATE public.passports
SET cover_outside_data = jsonb_set(
  cover_outside_data,
  '{elements}',
  public._rescale_cover_elements_v1(
    cover_outside_data->'elements',
    1224.0::numeric / 560.0::numeric,
     816.0::numeric / 392.0::numeric
  )
)
WHERE cover_outside_data IS NOT NULL
  AND jsonb_typeof(cover_outside_data->'elements') = 'array'
  AND jsonb_array_length(cover_outside_data->'elements') > 0;

-- Apply to inside-cover element arrays
UPDATE public.passports
SET cover_inside_data = jsonb_set(
  cover_inside_data,
  '{elements}',
  public._rescale_cover_elements_v1(
    cover_inside_data->'elements',
    1224.0::numeric / 560.0::numeric,
     816.0::numeric / 392.0::numeric
  )
)
WHERE cover_inside_data IS NOT NULL
  AND jsonb_typeof(cover_inside_data->'elements') = 'array'
  AND jsonb_array_length(cover_inside_data->'elements') > 0;

DROP FUNCTION public._rescale_cover_elements_v1(jsonb, numeric, numeric);
