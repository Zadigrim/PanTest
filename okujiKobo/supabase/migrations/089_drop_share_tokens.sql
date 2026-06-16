-- 089_drop_share_tokens.sql
--
-- Reconcile migration drift. The share_tokens table was declared in
-- 002_connect_schema.sql but never lived in the production schema (it
-- is absent from the live DB / generated types, and no DROP existed
-- anywhere in this tree). The only code that referenced it — the
-- /api/share/render route and the /share/[token] page — was a
-- half-built social share card with no live callers, removed alongside
-- this migration.
--
-- This makes the okujiKobo tree converge to reality on a fresh replay:
-- 002 creates the table, this drops it, so a `db reset` no longer
-- resurrects a dead table. IF EXISTS makes it a true no-op against the
-- current live schema (where the table is already absent).
--
-- This is unrelated to the roadmap's private-passport feature
-- (passports.visibility + passport_invite_codes + acquire-with-code),
-- which uses clean new schema and is untouched here. 002 is not edited.

DROP TABLE IF EXISTS public.share_tokens;
