-- Migration 017: page elements JSONB column on passport_pages
-- Mirrors OkujiDesigner/supabase/migrations/003_page_elements.sql.
-- Stores freely-positioned text labels, horizontal lines, and vertical lines
-- placed by the designer on each passport page.
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS elements jsonb NOT NULL DEFAULT '[]'::jsonb;
