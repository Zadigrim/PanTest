-- Migrate hline/vline elements to the unified line (vector) format.
-- Also seed rotation:0 on existing text elements that lack the field.
--
-- hline (x, y, width, height) → line: y1=y2=y+height/2, x1=x, x2=x+width
-- vline (x, y, width, height) → line: x1=x2=x+width/2, y1=y, y2=y+height

UPDATE public.passport_pages
SET elements = (
  SELECT jsonb_agg(
    CASE (elem->>'type')
      WHEN 'hline' THEN jsonb_build_object(
        'id',        elem->>'id',
        'type',      'line',
        'x1',        (elem->>'x')::float,
        'y1',        (elem->>'y')::float + (elem->>'height')::float / 2.0,
        'x2',        (elem->>'x')::float + (elem->>'width')::float,
        'y2',        (elem->>'y')::float + (elem->>'height')::float / 2.0,
        'thickness', COALESCE((elem->>'thickness')::float, 2),
        'lineColor', COALESCE(elem->>'lineColor', '0D1B2A')
      )
      WHEN 'vline' THEN jsonb_build_object(
        'id',        elem->>'id',
        'type',      'line',
        'x1',        (elem->>'x')::float + (elem->>'width')::float / 2.0,
        'y1',        (elem->>'y')::float,
        'x2',        (elem->>'x')::float + (elem->>'width')::float / 2.0,
        'y2',        (elem->>'y')::float + (elem->>'height')::float,
        'thickness', COALESCE((elem->>'thickness')::float, 2),
        'lineColor', COALESCE(elem->>'lineColor', '0D1B2A')
      )
      WHEN 'text' THEN
        CASE WHEN elem ? 'rotation'
          THEN elem
          ELSE elem || '{"rotation": 0}'::jsonb
        END
      ELSE elem
    END
  )
  FROM jsonb_array_elements(COALESCE(elements, '[]'::jsonb)) AS elem
)
WHERE elements IS NOT NULL;
