-- FIX-01: Unify the mobile-legacy and web-canonical token / employee /
-- proprietor schemas.
--
-- Before this migration the mobile employee terminal was operating on a
-- different schema universe from the web admin UI:
--
--   * Mobile read/wrote public.redemption_tokens; web read/wrote
--     public.completion_tokens. They are two parallel tables with no
--     rename linking them. Tokens generated through the web flow were
--     invisible to the mobile terminal.
--   * Mobile gated terminal access via public.employee_accounts (no
--     capability flags); the canonical model uses
--     public.employee_authorizations with can_verify and
--     can_distribute_prizes. Any user provisioned through the canonical
--     /manage/employees flow saw "No active employee account found" on
--     the mobile terminal.
--   * employee_accounts.proprietor_id and the mobile-side proprietors
--     table predated the web's institutions table. The two coexisted; the
--     web schema repointed passports.proprietor_id to FK institutions(id)
--     but left proprietors itself in place as a legacy parallel table.
--
-- Per DEC-19 (2026-05-30) the canonical migration tree is
-- okujiKobo/supabase/migrations/; per the FIX-01 closeout decision
-- ("no serious users; rebuild it correctly"), all three legacy tables
-- are retired here rather than left as historical baggage.
--
-- Ordering matters:
--   1. Extend completion_tokens with the columns the mobile UI relies on.
--   2. Backfill expires_at on existing completion_tokens rows before
--      adding the NOT NULL constraint.
--   3. Copy any redemption_tokens rows into completion_tokens, mapping
--      employee_accounts.id (the legacy actor reference) through to the
--      profiles.id behind that account row. completion_tokens already
--      FKs redeemed_by / distribution_logged_by to profiles(id), which
--      is the right canonical actor reference.
--   4. Ensure institutions has a row for every proprietor and copy
--      token_prefix across.
--   5. DROP redemption_tokens, employee_accounts, proprietors (in that
--      order — each FKs to the next).

-- ─────────────────────────────────────────────────────────────────────
-- 1. Extend completion_tokens with the mobile-UI columns.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.completion_tokens
  ADD COLUMN IF NOT EXISTS prize_given              text,
  ADD COLUMN IF NOT EXISTS extra_gift_card_cents    integer,
  ADD COLUMN IF NOT EXISTS distribution_location_id uuid,
  ADD COLUMN IF NOT EXISTS location_whitelist       uuid[],
  ADD COLUMN IF NOT EXISTS expires_at               timestamptz;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Backfill expires_at on existing rows, then set NOT NULL + default.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.completion_tokens
   SET expires_at = generated_at + interval '30 days'
 WHERE expires_at IS NULL;

ALTER TABLE public.completion_tokens
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

ALTER TABLE public.completion_tokens
  ALTER COLUMN expires_at SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Copy redemption_tokens rows into completion_tokens.
--
-- Skip if the source table doesn't exist (greenfield deploys never had
-- the mobile legacy tree). The DO block lets us guard the existence
-- check at migration-apply time.
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'redemption_tokens'
  ) THEN
    INSERT INTO public.completion_tokens (
      id, user_id, passport_id, page_id, token_code,
      generated_at, expires_at,
      redeemed_at, redeemed_by,
      prize_distributed, distribution_pending,
      distribution_logged_at, distribution_logged_by,
      prize_note, prize_given, extra_gift_card_cents,
      distribution_location_id, location_whitelist
    )
    SELECT
      rt.id,
      rt.user_id,
      pp.passport_id,
      rt.page_id,
      rt.token_code,
      rt.created_at,
      rt.expires_at,
      rt.scanned_at,
      (SELECT ea.user_id FROM public.employee_accounts ea WHERE ea.id = rt.scanned_by_employee),
      (rt.prize_distributed_at IS NOT NULL AND NOT rt.distribution_pending),
      rt.distribution_pending,
      rt.prize_distributed_at,
      (SELECT ea.user_id FROM public.employee_accounts ea WHERE ea.id = rt.distributed_by),
      rt.employee_note,
      rt.prize_given,
      rt.extra_gift_card_cents,
      rt.distribution_location_id,
      rt.location_whitelist
    FROM public.redemption_tokens rt
    JOIN public.passport_pages pp ON pp.id = rt.page_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4a. Add token_prefix to institutions (matching the proprietors guard).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS token_prefix text NOT NULL DEFAULT 'OKJ';

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_token_prefix_format;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_token_prefix_format
  CHECK (token_prefix ~ '^[A-Z0-9]{1,6}$');

-- 4b. Backfill institutions from proprietors (any IDs not already present)
-- and copy token_prefix across for the IDs that are.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'proprietors'
  ) THEN
    INSERT INTO public.institutions (id, name, slug, logo_url, tier)
    SELECT p.id, p.name, p.slug, p.logo_url, p.tier
      FROM public.proprietors p
     ON CONFLICT (id) DO NOTHING;

    UPDATE public.institutions i
       SET token_prefix = p.token_prefix
      FROM public.proprietors p
     WHERE p.id = i.id
       AND p.token_prefix IS NOT NULL
       AND p.token_prefix ~ '^[A-Z0-9]{1,6}$';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Retire the three legacy tables. CASCADE handles any stale
-- references (RLS policies, indexes, views) that the canonical tree
-- didn't override.
-- ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.redemption_tokens CASCADE;
DROP TABLE IF EXISTS public.employee_accounts CASCADE;
DROP TABLE IF EXISTS public.proprietors CASCADE;
