-- Separate opacity for custom background images (0–100, default 100).
-- The existing background_opacity field applies to standard pattern mode only.
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS custom_background_opacity integer NOT NULL DEFAULT 100
    CONSTRAINT custom_bg_opacity_range CHECK (custom_background_opacity >= 0 AND custom_background_opacity <= 100);
