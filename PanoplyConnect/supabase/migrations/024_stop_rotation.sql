-- Visual rotation for location boxes (0–359 degrees, default 0).
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS rotation integer NOT NULL DEFAULT 0
    CONSTRAINT stops_rotation_range CHECK (rotation >= 0 AND rotation < 360);
