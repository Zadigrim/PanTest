-- Phase 1, BLD-07 + BLD-08: Pro and Studio subscription state on profiles.
--
-- Per Appendix L.3 (Pro) and L.4 (Studio), users acquire subscription
-- access via paid billing or via comp grants. The effective status is
-- derived: a user is "active Pro" if pro_status = 'active' AND
-- (pro_expires_at IS NULL OR pro_expires_at > now()). Same for Studio.
--
-- The 'source' column distinguishes paid vs comp. Phase 4 (billing) sets
-- 'paid'; Phase 1's comp admin UI sets 'comp' (via the trigger in 036).
--
-- pro_expires_at already exists in the legacy schema; we keep it. Adding
-- studio_expires_at to match.
--
-- Phase 1 is schema-only. lib/roles.ts does NOT yet read these columns;
-- that wiring is Phase 2 work.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_status         text         NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pro_source         text,
  ADD COLUMN IF NOT EXISTS studio_status      text         NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS studio_source      text,
  ADD COLUMN IF NOT EXISTS studio_expires_at  timestamptz;

-- pro_expires_at carried forward from the legacy schema; no ADD needed.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pro_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pro_status_check
  CHECK (pro_status IN ('none', 'active', 'past_due', 'canceled'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pro_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pro_source_check
  CHECK (pro_source IS NULL OR pro_source IN ('paid', 'comp'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_studio_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_studio_status_check
  CHECK (studio_status IN ('none', 'active', 'past_due', 'canceled'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_studio_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_studio_source_check
  CHECK (studio_source IS NULL OR studio_source IN ('paid', 'comp'));
