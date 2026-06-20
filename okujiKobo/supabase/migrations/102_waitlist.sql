-- Migration 102: closed-beta waitlist capture (okuji-landing).
--
-- The public landing page (okuji-landing — a separate static repo) collects
-- emails for the closed beta. A SEPARATE, explicit opt-in on that form captures
-- consent to a printed journey keepsake (ruling 7: "make it explicit on the
-- okuji-landing page").
--
-- This table is the UPSTREAM of profiles.keepsake_consent_at (migration 101):
-- a waitlister has no account yet, so consent is captured here at signup. When
-- a waitlister is later selected into the beta and a profile is created, an
-- admin propagates their consent onto profiles.keepsake_consent_at, which is
-- what the keepsake generator gates on. Capturing the intent honestly at the
-- moment they give it — before any account exists — is the point.
--
-- Access: writes come ONLY from the okuji-landing serverless function via the
-- service-role key (which bypasses RLS); there is intentionally no anon/auth
-- INSERT policy, so the table can never be written or enumerated from a browser
-- client. Reads are admin-only via the canonical is_platform_admin() gate.
--
-- ROLLBACK: drop table public.waitlist. Additive; touches no existing table.

create table if not exists public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  -- The explicit, separate keepsake opt-in (ruling 7). Defaults false: joining
  -- the waitlist never implies consent to a printed keepsake of a private
  -- journal — the collector must actively check the box.
  keepsake_consent boolean not null default false,
  -- Free-text provenance ('okuji-landing'), so a later second capture surface
  -- is distinguishable without a schema change.
  source           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One row per email; re-submitting updates consent/timestamp (upsert) rather
  -- than piling up duplicates.
  unique (email)
);

comment on table public.waitlist is
  'Closed-beta signups from okuji-landing. keepsake_consent is the explicit, separate opt-in (ruling 7) and is upstream of profiles.keepsake_consent_at (set by an admin when a waitlister is selected into the beta). Service-role write only; admin read only.';

create index if not exists waitlist_created_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- Admin-only read. No INSERT/UPDATE/DELETE policy exists by design: only the
-- service role (the landing function) writes, and it bypasses RLS.
drop policy if exists waitlist_admin_read on public.waitlist;
create policy waitlist_admin_read on public.waitlist
  for select to authenticated
  using (public.is_platform_admin());

-- Keep updated_at honest on upsert. Reuses the shared trigger function from the
-- mobile base schema (public.update_updated_at), already present in this project.
drop trigger if exists waitlist_updated_at on public.waitlist;
create trigger waitlist_updated_at
  before update on public.waitlist
  for each row execute function public.update_updated_at();
