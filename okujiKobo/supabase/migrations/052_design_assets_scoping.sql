-- Per-passport scoping for design_assets.
--
-- Previously every asset a creator uploaded appeared in the asset picker
-- of EVERY passport they designed. Once a user has a couple of passports
-- (a reading-program with book covers, a town-walk with location photos),
-- the picker fills with images that are irrelevant to whatever passport
-- they're currently editing.
--
-- Add scoped_passport_id to design_assets:
--   NULL                  → library-wide (shows in every picker)
--   <passport uuid>       → only shows when designing that passport
--
-- ON DELETE SET NULL: if the scoped passport is deleted, the asset
-- demotes to library-wide. We never silently delete user-uploaded
-- files; the file lives on, just becomes visible everywhere again so
-- the user can find it and decide what to do (delete it via the
-- assets page, or re-scope to another passport).
--
-- Existing rows: scoped_passport_id defaults to NULL = library-wide.
-- That deliberately preserves the pre-scoping behavior — nothing
-- disappears from any picker on migration. Users tidy by restricting
-- assets one-by-one via the assets page.
--
-- Partial index: scoped lookups are the common case (the designer
-- picker query is .or(scoped.is.null, scoped.eq.{current})); a
-- partial index on the non-null subset keeps the index small while
-- still answering scoped lookups fast.

ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS scoped_passport_id uuid
    REFERENCES public.passports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS design_assets_scoped_passport_idx
  ON public.design_assets(scoped_passport_id)
  WHERE scoped_passport_id IS NOT NULL;
