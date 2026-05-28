-- One-time reissue of stop QR tokens to cryptographically-random values.
--
-- WHY: existing tokens were generated client-side via Math.random
-- ("OKUJI-<8 hex>-<6 base36>"), which is predictable and forgeable. The
-- application now provisions tokens server-side via the provision-qr-token
-- edge function using crypto.getRandomValues (~128 bits of entropy).
--
-- IMPACT: any printed/screenshotted QR codes using the old tokens stop
-- working after this migration runs. No data is lost; designers can
-- re-issue or re-print using the new tokens.
--
-- Re-running this migration regenerates tokens again (idempotent in form,
-- but each run invalidates prior QRs). Run once on production.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.stops
SET qr_code_id = 'OKUJI-' || translate(
  rtrim(encode(gen_random_bytes(16), 'base64'), '='),
  '+/', '-_'
)
WHERE qr_code_id IS NOT NULL;
