-- Per-proprietor redemption token prefix.
--
-- Previously the redemption token format was hardcoded as 'MCM-XXXX-XX' in the
-- generate-token edge function — a McMenamins-only string baked into the
-- generator. This migration adds a configurable prefix on proprietors so a
-- non-McMenamins partner's tokens don't start with MCM-. Default for new
-- proprietors is 'OKJ' (generic Okuji). Existing McMenamins rows are
-- back-filled to 'MCM' to preserve their printed/signage tokens.
--
-- Token entropy is unchanged: this is a prefix-only configuration, not a
-- security characteristic change. The format check keeps the prefix to
-- A-Z/0-9 / 1–6 chars so it can't break the downstream parser.

ALTER TABLE public.proprietors
  ADD COLUMN IF NOT EXISTS token_prefix text NOT NULL DEFAULT 'OKJ';

-- Permissive format guard. Allows letters and digits, 1–6 chars.
ALTER TABLE public.proprietors
  DROP CONSTRAINT IF EXISTS proprietors_token_prefix_format;
ALTER TABLE public.proprietors
  ADD CONSTRAINT proprietors_token_prefix_format
  CHECK (token_prefix ~ '^[A-Z0-9]{1,6}$');

-- Back-fill: existing McMenamins rows keep their MCM- prefix.
UPDATE public.proprietors
SET token_prefix = 'MCM'
WHERE slug = 'mcmenamins' OR lower(name) LIKE 'mcmenamins%';
