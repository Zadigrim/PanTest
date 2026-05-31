-- BLD-32: per-passport demo mode flag.
--
-- When set, platform admins viewing this passport bypass GPS verification,
-- acquisition gates, stop ordering, and capability flags so a demo can be
-- run end-to-end without staging real-world conditions. Non-admins viewing
-- the same passport get unchanged behavior — the flag is an admin-only
-- bypass, not a relaxation of the actual access model.
--
-- Demo data (stamps, journal entries, photos) created via this bypass is
-- NOT tagged. The deployment plan is to TRUNCATE demo passports + their
-- collector_passports + dependent stamps/journal rows before going live.
-- Adding an is_demo_data column on every dependent table to support
-- selective filtering was considered and explicitly rejected — the
-- truncate-before-launch path is simpler and avoids polluting the audit
-- semantics of every downstream query.
--
-- No RLS change: write access to passports already requires creator_id =
-- auth.uid() OR platform admin OR can_design at the proprietor institution
-- (migration 038). Toggling is_demo flows through that existing gate.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
