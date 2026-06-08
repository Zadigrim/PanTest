-- Migration 015: stop_qr_tokens — vendor-presented single-use QR (M2)
--
-- Mobile-tree migration. Lives here because it references stops
-- (mobile-tree-owned, defined in 001).
--
-- DEPLOY ORDER: independent of the other M2 migrations; can run
-- anywhere in the M2 sequence after the migrations that created
-- stops + profiles (already shipped).
--
-- THE TABLE
--
-- Per Nathan's M2 ruling: "vendor-presented one-off single-use
-- QR per punch (table now, issuing function in M3)." This
-- migration creates the table + RLS. The issue + redeem
-- functions land in M3.
--
-- A stop_qr_token is a SHORT-LIVED secret a vendor presents
-- (printed receipt, employee-device-displayed QR, etc.) that a
-- holder scans to consume one punch. Distinct from the existing
-- per-stop qr_code_id on stops (which is a STABLE secret tied
-- to a physical location and used by the persistent-passport
-- stamping flow). The two mechanisms coexist; the legacy
-- qr_code_id is unchanged.
--
-- Fields:
--   token         — random secret (64+ bits entropy; M3's issue
--                   function chooses the generator)
--   single_use    — defaults TRUE; the redeem function flips
--                   consumed_at on success and refuses re-use
--   expires_at    — NULL = no expiry (rare; defensive). Typical
--                   tokens have a short TTL set by issue.
--   consumed_at   — when redeem succeeded (state, never DELETE
--                   per CLAUDE.md #1)
--   consumed_by   — the user_id that consumed it; FK profiles
--   created_by    — the vendor user_id that issued it; FK profiles
--
-- RLS (per Phase 0 confirmation — option 3 confirmed):
--   Admin-only on every operation. The token IS the secret;
--   exposing it to ANY non-admin (including the creator!) via
--   direct SELECT would defeat the single-use semantics. M3's
--   issue function returns the freshly-generated token to its
--   caller exactly once via its return value; after that, no
--   surface re-displays it.
--
--   Service-role clients (M3 functions) bypass RLS as needed
--   for issue + redeem; the policies don't need to cover those
--   paths.
--
-- INDEX: token is unique-indexed so redeem-by-token is O(1).
--
-- ROLLBACK: DROP TABLE. No application surface reads from this
-- table at M2 ship time; the M3 + M4 surfaces hadn't shipped
-- yet, so rollback is safe.

CREATE TABLE IF NOT EXISTS public.stop_qr_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id      uuid NOT NULL REFERENCES public.stops(id)    ON DELETE CASCADE,
  token        text UNIQUE NOT NULL,
  single_use   boolean NOT NULL DEFAULT true,
  expires_at   timestamptz NULL,
  consumed_at  timestamptz NULL,
  consumed_by  uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by   uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Reads of active tokens by stop — speeds the M3 redeem path
-- ("find unconsumed token for stop X with token Y"). Partial
-- so consumed tokens don't bloat the index.
CREATE INDEX IF NOT EXISTS stop_qr_tokens_active_by_stop_idx
  ON public.stop_qr_tokens (stop_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS stop_qr_tokens_created_by_idx
  ON public.stop_qr_tokens (created_by);

ALTER TABLE public.stop_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Admin-only on every operation. Tokens are secrets; the
-- display-once UX in M4 surfaces them via M3's issue function
-- return value, not via direct table read.
DROP POLICY IF EXISTS "stop_qr_tokens_admin_only" ON public.stop_qr_tokens;
CREATE POLICY "stop_qr_tokens_admin_only" ON public.stop_qr_tokens
  FOR ALL
  USING (public.is_admin() = true)
  WITH CHECK (public.is_admin() = true);
