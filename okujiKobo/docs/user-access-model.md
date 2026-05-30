# Okuji user &amp; access model — current state

**Status:** as of 2026-05-30, branch `claude/fervent-gates-1xa4b`. Last migrations reviewed: web `030`, mobile `011`, baseline `000`.

**Purpose:** authoritative map of every user type, every role value, every capability flag, and every access mechanism present in the codebase today. This is the input for redesigning the target state — it does NOT propose a target.

**Audience:** technically literate non-developer. Code paths are cited so anything here can be verified, but the prose stands on its own.

A note on verification: every claim below was confirmed by reading the file at the cited line as of the date above. Where a claim is INFERRED from absence (e.g., "no code path sets this value"), the inference is called out explicitly.

---

## Section 1 — Quick reference (the elevator answer)

Okuji has **two parallel role systems** stacked on top of each other, and they don't fully agree:

1. **The mobile-schema `profiles.role` text column** — values `collector | creator | employee | admin`. Only `collector` is ever written by application code; the other three values exist in the schema but are unreachable through any UI or API. They can only be set by manual SQL.
2. **The web-schema "okujiKobo five-role" model** — values `individual_creator | institutional_manager | institutional_employee | designer | platform_admin`. These are NOT stored as a single column — each is *derived* at request time from a different signal (an admin boolean flag, an `employee_authorizations` row, ownership of an `institutions` row, an array column, or a universal fallback).

On top of that, there are **three orthogonal dimensions** that combine to determine what any given user can do:

| Dimension | Where it lives | How it's set |
|---|---|---|
| Platform admin? | `profiles.is_platform_admin boolean` | Manual SQL only — no UI |
| Institution memberships | `employee_authorizations` rows | Inserted by an institutional manager via the `/manage/employees` UI |
| Per-membership capabilities | 3 booleans on each `employee_authorizations` row | Same UI |

The **one-line summary of every user type currently representable**:

| User type | What they can do |
|---|---|
| **Collector** (default for every sign-up) | Browse the marketplace, acquire free passports, stamp stops in the mobile app, keep a journal |
| **Creator** (every authenticated user) | Everything a collector can do, PLUS design and publish passports under their own name |
| **Institutional employee** (has at least one `employee_authorizations` row with `can_verify=true`) | Everything above, PLUS verify and redeem completion tokens for their institution, see stamps placed on its passports, run the employee terminal, use the mobile Field tab |
| **Institutional employee with `can_distribute_prizes`** | Above, PLUS edit prize configurations and mark tokens redeemed |
| **Institutional employee with `can_add_extras`** | Above, PLUS attach an extra gift-card amount when redeeming (gated by API only — see §6) |
| **Institutional manager** (auth user whose UID equals an `institutions.id`) | Manage employees and institution metadata. *In practice this user type may be unreachable — see §6.* |
| **Platform admin** (`profiles.is_platform_admin = true`) | Everything, on every institution, on every passport, on every table |

There is **no** "verified creator," "approved publisher," "support" role, or any tier between collector and admin. There is no invitation flow; every employee must already have a Supabase account before they can be added.

---

## Section 2 — User types and roles in detail

### 2.1 Collector — the universal default

Every Supabase signup becomes a collector. This happens via the database trigger `handle_new_user()` (most recent definition at `supabase/migrations/011_harden_signup_trigger.sql:32-81`), which fires on `INSERT INTO auth.users` and creates a `profiles` row. The `role` column defaults to `'collector'` per the CHECK constraint in `supabase/migrations/001_initial_schema.sql:13-14`.

The mobile signup form also writes `role: 'collector'` explicitly (`app/(auth)/register.tsx:32`). The web signup form does not pass `role` at all (`okujiKobo/app/(auth)/signup/page.tsx:39-47`) — it relies on the trigger and the column default.

What collectors can do is determined entirely by Row-Level Security policies on `passports`, `acquisitions`, `stamps`, `completion_tokens`, etc. See §4 for the matrix.

### 2.2 Creator — a relationship, treated as a role

"Creator" appears in three different forms in the code, which is the source of most of the confusion:

1. **As a `profiles.role` value** — `'creator'` is in the CHECK constraint, but **no application code path writes it**. Verified by exhaustive grep: every `from('profiles').insert(...)` and `.update(...)` either sets `role: 'collector'` or leaves the column untouched. To promote a user to `profiles.role='creator'`, an operator must run SQL directly.
2. **As a foreign-key column** — `passports.creator_id` (`supabase/migrations/001_initial_schema.sql:50`) is the user who created a passport. This is a *relationship*, not a property of the user — anyone who creates a passport gets this FK pointed at them.
3. **As a derived "okujiKobo role"** — `'individual_creator'` in `okujiKobo/lib/roles.ts:5-10`. This is computed: a user becomes `individual_creator` if `profiles.role === 'creator'` (`lib/roles.ts:50`) *or* — and this is the operational rule — if no other role applies (`lib/roles.ts:94-97`, "Fallback: every authenticated user is at minimum an individual_creator").

**Net effect: every authenticated user is implicitly a creator.** The web designer route `okujiKobo/app/api/design/create/route.ts:10-49` only checks `auth.getUser()` — no role check, no allow-list, no approval — and writes `creator_id: user.id`. RLS allows the creator to flip `is_published = true` on their own passport with no moderation step (`okujiKobo/supabase/migrations/012_blockpoint4.sql:278-280`).

There is scaffolding for a "Design Certified" badge (`okujiKobo/components/marketplace/PassportCard.tsx:70`) but the field `creator_is_certified` is hardcoded to `false` for every passport at `okujiKobo/app/explore/page.tsx:276`. INFERRED: a creator-approval system was planned but never built.

### 2.3 Institutional employee — the only role with structured capabilities

A user becomes an institutional employee when an institutional manager (or platform admin) inserts a row into `employee_authorizations` linking the user's UID to an institution. The mechanism is the `/manage/employees` page (`okujiKobo/app/(institutional)/manage/employees/page.tsx:264-276`) or the platform-admin equivalent at `/access/institutions/[id]` (`okujiKobo/app/access/institutions/[id]/page.tsx:525-537`).

The membership row carries three boolean capability flags (see §3) plus a free-text `role_label` column (e.g., "Educator," "Manager," "Staff") that is purely cosmetic — it is never read by any policy or API.

There is **no invitation flow**. Both add-employee paths first call `api/employees/lookup` (`okujiKobo/app/api/employees/lookup/route.ts`) to find the invitee's existing UID by email. If they don't have a Supabase account, the manager cannot add them. (And as a side issue — see §6 — this route is itself an authorization weakness.)

A user can hold rows at multiple institutions with different flag combinations at each. The schema enforces `UNIQUE(institution_id, user_id)` (`okujiKobo/supabase/migrations/002_connect_schema.sql:198`), so each (user, institution) pair has at most one row.

### 2.4 Institutional manager — the "manage your own institution" role

This is the most unusual user type. The intended mechanism, encoded in the web role taxonomy (`okujiKobo/lib/roles.ts:76-92`) and in RLS policies like `emp_auth_manager_read` (`okujiKobo/supabase/migrations/014_blockpoint6.sql:118-127`), is: a user is a manager of an institution if `institutions.id = auth.uid()` — i.e., the institution's primary key equals the user's auth UUID.

**However**, no application code creates such rows. The institution-create route at `okujiKobo/app/api/institutions/route.ts:55-78` does not set `id` — it relies on `gen_random_uuid()`. The signup forms do not create institutions. INFERRED: this user type was designed for a flow where the institution itself signs up as a user (the institution literally *is* an auth user, with the institution's UUID equalling their own user UUID). That flow does not exist today. To produce a manager, an operator would have to run SQL.

The practical consequence is that **the institutional-manager role is unreachable through the UI** as of today. It survives in the codebase as RLS policies and dashboard branches that never fire.

### 2.5 Designer — a fifth role with no entry path

`'designer'` is one of the five derived web roles (`okujiKobo/lib/roles.ts:9`). It is granted only by adding the literal `'designer'` to `profiles.connect_roles[]` (`lib/roles.ts:54-59`), which is a text-array column added in migration `004_classifiers_roles.sql`. No code path writes this array — only SQL administration can set it.

INFERRED: this was intended for a fee-paying or platform-curated designer tier, but no onboarding flow exists.

### 2.6 Platform admin — binary, manually set

A user is a platform admin if `profiles.is_platform_admin = true` (column added in `okujiKobo/supabase/migrations/012_blockpoint4.sql:5-6`). The SQL function `is_platform_admin()` reads this column under `SECURITY DEFINER` to bypass RLS recursion; after migration 013, `is_admin()` is literally a one-line wrapper that returns `is_platform_admin()` (`okujiKobo/supabase/migrations/013_blockpoint5.sql:23-32`). They are equivalent.

The flag is **binary** — there is no super-admin, support, or staff tier. It is **set only by manual SQL** — no UI promotes a user. The migration that introduces it includes a comment that explicitly tells the operator to run `UPDATE public.profiles SET is_platform_admin = true WHERE id = '<your-user-id>'`.

In addition to the canonical boolean check, two other "admin" tests exist in the code and can disagree with it:

- One API route checks `profile.role === 'admin'` instead — `okujiKobo/app/api/admin/compute-quality-scores/route.ts:86`. If a real platform admin's `profiles.role` is `'collector'` (the default), this route refuses them.
- One page checks `connect_roles.includes('platform_admin')` — `okujiKobo/app/access/page.tsx:763-765`. Accepts either the boolean or this array entry.

So a fully-correctly-provisioned platform admin needs all three signals set, OR the operator needs to know which surfaces check which.

---

## Section 3 — Capability flags (every flag on `employee_authorizations`)

There are exactly **three** boolean capability columns on `employee_authorizations`. The README's mention of `can_verify` and `can_distribute_prizes` is incomplete; the third is `can_add_extras`.

| Flag | Default | What it gates | Enforced by |
|---|---|---|---|
| `can_verify` | `true` | Validating and viewing completion tokens; reading stamps on the institution's passports; running the employee terminal; appearing as an employee to the mobile Field tab | RLS (`tokens_employee_read`, `stamps_employee_read`) + API routes (`/api/token/validate`, `/api/token/redeem`) + mobile `EmployeeContext` |
| `can_distribute_prizes` | `true` | Marking a token redeemed; writing prize configurations | RLS (`tokens_employee_update`, `prize_config_inst_write`) |
| `can_add_extras` | `false` | Attaching an extra gift-card amount during redemption | **API route ONLY** (`/api/token/redeem`); NOT enforced by RLS — see §6 |

Schema reference: `okujiKobo/supabase/migrations/002_connect_schema.sql:188-199`, recreated unchanged in `012_blockpoint4.sql:167-178`.

**Behavior on NULL.** In application reads the value is coerced to `false` (`okujiKobo/app/(institutional)/manage/employees/page.tsx:531-533, 663-665`). RLS policies use strict equality (`ea.can_verify = true`), so NULL behaves like `false` at the database level too.

**Default-true is unusual.** Inserting a row with no overrides grants `can_verify` and `can_distribute_prizes`. The manage-employees UI explicitly overrides this to `false, false, false` on the new-employee form (`employees/page.tsx:204-209`), but a row inserted via SQL or any other code path defaults to verify + distribute. This is a real footgun.

**`role_label`** is a free-text column with no authorization meaning. It exists for display only.

**No other capability mechanism** exists on this table — no `can_manage_employees`, no `can_edit_institution`, no `can_view_analytics`. Routes that need these distinctions either gate on `is_platform_admin` (correct) or accept any `employee_authorizations` row (which means any employee, regardless of flags — see §6 for the cases where this is too permissive).

**Other capability-shaped columns elsewhere:**
- `profiles.is_platform_admin` (covered in §2.6).
- `profiles.connect_roles text[]` — read by `okujiKobo/lib/roles.ts` and the access pages; no writer.
- `profiles.auth_provider` — set by the signup trigger; not used for authorization.
- `passports.proprietor_id` — links a passport to an institution, drives employee read access through the joins in the RLS policies. Not a flag, but it's the link that makes employee capabilities meaningful.

---

## Section 4 — Access matrix

This is the heart of the document. It shows which user types can do which actions on which surfaces.

Conventions in the table:
- **Self** = the user's own row (`user_id = auth.uid()` or equivalent).
- **Owned passport** = a passport where `creator_id = auth.uid()`.
- **Public-published** = `is_published = true`.
- **Inst-N** = an institution `N` where the user has an `employee_authorizations` row.
- ✅ = full access. **r** = read-only. **w** = write (insert/update). **d** = delete. **—** = no access.
- "Admin bypass" means platform admins bypass the policy via the `is_admin() OR …` clause in the USING expression.

### 4.1 Identity and membership surfaces

| Table | Public collector / creator | Inst employee at Inst-N | Inst manager (unreachable today) | Platform admin |
|---|---|---|---|---|
| `profiles` | r everyone, w self | r everyone, w self | r everyone, w self | ✅ admin bypass |
| `institutions` | r everyone (after migration 026) | r everyone, no write | r/w on self (id = auth.uid()) | ✅ |
| `employee_authorizations` | r self only | r self + r rows the manager who issued holds (`authorized_by = auth.uid()`) | r/w/d rows at their institution; **cannot self-update** (policy misnamed `emp_auth_self_update` — see §6) | ✅ |

Citations: `012_blockpoint4.sql:269-275, 484-491`; `013_blockpoint5.sql:40-46`; `014_blockpoint6.sql:104-156`; `026_institutions_rls.sql`.

### 4.2 Passport content surfaces

| Table | Public collector / creator | Inst employee at Inst-N | Inst manager | Platform admin |
|---|---|---|---|---|
| `passports` (their own draft) | r/w/d own | r/w/d their own (creator_id-based; institution affiliation gives no extra access) | as creator only | ✅ |
| `passports` (published) | r everyone | r everyone | r everyone | ✅ |
| `passport_pages`, `stops` (own draft) | r/w/d own | r/w/d own (creator-based) | as creator only | ✅ |
| `passport_pages`, `stops` (published or shared) | r | r | r | ✅ |
| `passport_autosaves` | r/w own draft | r/w own draft | as creator only | ✅ |
| `design_assets` (own) | r/w/d own | r/w/d own | as creator only | ✅ |
| `design_assets` (institution-scoped) | r if `is_built_in = true` | r if `institution_id` matches one of their authorizations | r if matching | ✅ |
| `print_jobs` | r/w own | r/w own | as creator only | ✅ |

Citations: `012_blockpoint4.sql:278-327, 506-527, 540-551`.

**Important observation.** Institutional employees have *no* write access to `passports` owned by their institution — only the original `creator_id` does. The proprietor link does not grant edit rights through RLS. In practice, the creator and the institution-owner are typically the same user (the institutional manager pattern), but if that breaks down, an employee can't edit a passport even if their institution owns it.

### 4.3 Collector-activity surfaces

| Table | Collector | Employee at the issuing institution | Platform admin |
|---|---|---|---|
| `acquisitions` | r/w own | — (no policy) | ✅ |
| `collector_passports` (mobile) | r/w own | — | ✅ |
| `stamps` | r/w own | r if `can_verify = true` AND the stamp's passport belongs to their institution | ✅ |
| `completion_tokens` | r own | r if `can_verify = true`; **w (update)** if `can_distribute_prizes = true` | ✅ |

Citations: `012_blockpoint4.sql:329-405, 506-508`.

`completion_tokens` has no INSERT policy — generation happens server-side under the service role via the `generate-token` edge function. INFERRED: this is correct; clients should not mint tokens.

### 4.4 Institution-program surfaces

| Table | Other employees | Employee with the relevant flag | Manager | Admin |
|---|---|---|---|---|
| `prize_configurations` | r if employee of the institution | w if `can_distribute_prizes` | r/w | ✅ |
| `institution_subscriptions` | r if employee | r only — no one has write policy | r only | ✅ (via bypass) |

Citations: `012_blockpoint4.sql:440-474`.

### 4.5 API routes — gates by route

Reads-only routes are omitted for brevity. The non-trivial mutation/redaction-risk routes:

| Route | Method | Gate (verified in code) | Who can call |
|---|---|---|---|
| `api/acquire` | POST | `getUser()`; passport must be published and free | Any signed-in user |
| `api/admin/compute-quality-scores` | POST | `profile.role === 'admin'` (legacy check) | Anyone with `role='admin'` literally — *will refuse a real platform admin whose role is collector* |
| `api/analytics/[passportId]` | GET | `getUser()` + any `employee_authorizations` row matching the passport's proprietor | Any employee, no flag check |
| `api/assets/[id]` DELETE | DELETE | `is_platform_admin` OR `owner_id = user.id`; blocks if `is_built_in` | Owner or admin |
| `api/assets/upload` | POST | `getUser()` only | Any signed-in user |
| `api/checkout` | POST | `getUser()`; passport must be published, paid | Any signed-in user |
| `api/design/create` | POST | `getUser()` only | Any signed-in user |
| `api/employees/lookup` | POST | **`getUser()` only** — no scoping | Any signed-in user. *Email-enumeration oracle* — see §6 |
| `api/institutions/[id]` PATCH | PATCH | `getUser()` + (admin OR any employee row at the institution) | Any employee can edit institution metadata. No `can_manage_*` flag check — see §6 |
| `api/institutions` POST | POST | `is_platform_admin` only | Platform admins |
| `api/notify/completion` | POST | `getUser()`; emails only to `user.email` | Any signed-in user; cannot be abused for arbitrary recipients |
| `api/passports/[id]/print-pdf` | POST | `getUser()` + (creator OR employee at the proprietor) | Creator or any employee of owning institution |
| `api/share/render` | POST | `getUser()` only; reads any passport id | Any signed-in user (no publish-status check); token uses `Math.random` |
| `api/stops/import` | POST | `getUser()`; source must be `is_shared`; target passport must be owned | Owner of the target passport |
| `api/tip` | POST | `getUser()` only | Any signed-in user |
| `api/token/redeem` | POST | `can_verify = true`; `can_add_extras` required if `extraGiftCardCents > 0` | Verifying employees; extras-capable employees for the extras |
| `api/token/validate` | POST | `can_verify = true` | Verifying employees |
| `api/webhook/stripe` | POST | Stripe signature; service-role | Stripe only |

---

## Section 5 — How access combines in practice

Five scenarios that show how the three dimensions (platform admin × institution memberships × capability flags) layer.

### Scenario A — A new sign-up from the mobile app

A user installs the mobile app and signs up with email/password. The signup trigger creates `profiles { id: <uid>, role: 'collector', is_platform_admin: false }`. The mobile signup also explicitly INSERTs the same row (this races with the trigger and likely silently fails on duplicate-PK, but the row already exists, so the outcome is correct).

What they can do:
- Browse the marketplace; acquire free passports; stamp stops; keep a journal. Standard collector loop.
- **Also** design and publish a passport. Nothing prevents it. They show up on the public marketplace alongside institution-owned passports, with no badge to distinguish them. Their author byline pulls from `profiles.display_name` (`okujiKobo/app/explore/page.tsx:122`).
- They CANNOT verify tokens, redeem prizes, or see other users' stamps.

### Scenario B — An institutional manager runs their own museum

The museum has been provisioned out-of-band: an `institutions` row exists with the museum's name, and the museum's *manager user* has an `employee_authorizations` row at the museum with all three capability flags true. The manager runs the employee terminal and adds three more staff via `/manage/employees`; each new staff member becomes an `employee_authorizations` row with manager-chosen flags. The new staff log into the kiosk; verification and redemption work for them.

What the manager sees that a regular employee doesn't:
- The `/manage` UI is gated on having any institution membership (`okujiKobo/app/(institutional)/manage/layout.tsx`). So all employees see it, not just managers. There is no "manager vs employee" distinction in the codebase today — every flag is per-row.
- "Manager" in the README sense is a person who happens to hold all three capability flags. The DB has no `manager` concept distinct from a maximally-flagged employee.

### Scenario C — A user employed at two institutions with different flags

A barista works weekends at Cafe Alpha (`can_verify=true, can_distribute_prizes=false, can_add_extras=false`) and weekdays at Bookshop Bravo (`can_verify=true, can_distribute_prizes=true, can_add_extras=true`). Two `employee_authorizations` rows exist, both keyed to her UID, one per institution.

In the mobile app, `EmployeeContext` (`contexts/EmployeeContext.tsx:62-94`) queries her authorizations filtered to `can_verify = true` and picks ONE row with `.limit(1).single()`. The Field tab will show stops for ONE of the two institutions, non-deterministically. **There is no UI for her to choose which institution she is currently acting for** — and this is a real, observable bug for any multi-institution employee.

The web is similar: `okujiKobo/app/(institutional)/manage/layout.tsx:101-108` also takes `.limit(1).single()`. The manage dashboard for her will display one of the two institutions, but the sidebar gives no way to switch.

### Scenario D — A platform admin

Their `profiles.is_platform_admin = true`. Every RLS policy in the schema has an `OR is_admin() = true` clause, so they can read and write every table. The admin role is propagated to most application code via the `is_platform_admin()` RPC (`okujiKobo/lib/roles.ts:37`).

When they visit `/manage`, the layout detects them as admin and *synthesises* a fake `authorization` row pointing at whichever `institutions` row Postgres returns from `SELECT id FROM institutions LIMIT 1` with no ORDER BY (`okujiKobo/app/(institutional)/manage/layout.tsx:86-97`). Whatever they then do in `/manage` operates on that arbitrary institution. The README calls this "platform admins are auto-assigned the first institution" — that wording suggests a persisted assignment, but in fact **no row is inserted**. It's a render-time fiction. With multiple institutions, the chosen one is non-deterministic.

One trap: the route `api/admin/compute-quality-scores` checks `profile.role === 'admin'`, not `is_platform_admin`. A platform admin whose `profiles.role` is the default `'collector'` (which is everyone, since no path sets `role='admin'`) will receive 403 from that route. The operator must also run `UPDATE profiles SET role='admin' WHERE id = '<uid>'` to enable that one route. Inconsistency, not a security bug.

### Scenario E — A user who is both a platform admin and an institutional employee

Two signals stack additively. `is_platform_admin` gives admin bypass on every RLS policy. The `employee_authorizations` row independently gives the employee surfaces. These do not conflict — both apply.

The role switcher (`okujiKobo/components/layout/RoleSwitcher.tsx`) will offer them every applicable role in its dropdown (admin, employee, individual_creator) and writes the choice to the `okuji_active_role` cookie. The cookie is **cosmetic** — it changes which dashboard zone the home page renders (`okujiKobo/app/page.tsx:139-142, 248, 273, 329`) but no RLS or API route reads it. A user who has switched the cookie to `individual_creator` can still query admin data via any route they have rights to; the cookie does not down-grant capabilities.

---

## Section 6 — Gaps, inconsistencies, and dead code

Items most relevant to the design conversation, ordered by impact.

### Security and authorization

1. **`api/employees/lookup` is an email-enumeration oracle.** Any signed-in user can probe any email address and learn whether it has an Okuji account, plus the internal UID. The route checks `getUser()` only — no scoping to the caller's institutions or admin status. (`okujiKobo/app/api/employees/lookup/route.ts:14-30`.) The README flagged this; it remains unfixed.
2. **`api/institutions/[id]` PATCH allows any employee to edit institution metadata.** The check is "have ANY `employee_authorizations` row at this institution." An employee with `can_verify=true` and everything else `false` can rename the institution, edit its contact info, internal notes, and pricing inputs. The route selects `can_add_extras` from the row but never tests it — looks like a copy-paste from a sibling. (`okujiKobo/app/api/institutions/[id]/route.ts:18-25`.)
3. **`can_add_extras` is enforced only at the API layer**, not by RLS. The `tokens_employee_update` policy only checks `can_distribute_prizes`. A caller using PostgREST directly (skipping the API route) can mark a token redeemed with a prize note that includes extra-cents without holding the flag. (`okujiKobo/supabase/migrations/012_blockpoint4.sql:394-405` vs `okujiKobo/app/api/token/redeem/route.ts:128-135`.)
4. **`api/share/render` accepts any passport id.** It reads the passport regardless of publish status or caller's relationship to it, then inserts a `share_tokens` row tied to the caller. Token uses `Math.random()` (low-risk because the data is meant to be shareable, but still).
5. **Storage upload policies do not enforce per-user folders for the `design-assets` bucket.** Inserts succeed if `bucket_id = 'design-assets'`; only deletes check folder ownership. The application code constructs paths under `{user.id}/...`, so legitimate use is fine, but a hand-crafted upload could write into another user's folder if their `design_assets` insert sets `owner_id = user.id`. (`okuji-db/supabase/migrations/000_baseline.sql:768-781`.)
6. **Migration 026 fixed a historical bug**: RLS was OFF on the `institutions` table between migrations 012 and 026. During that window, the policies created in 012 had no effect and writes to `institutions` were unrestricted. The fix is in place; any audit of historical writes would need to consider this window.

### Dead and unreachable code

7. **Three `profiles.role` values are unreachable through the UI.** `creator`, `employee`, and `admin` exist in the CHECK constraint but no application code path writes them. The mobile profile screen reads `role === 'employee' || role === 'admin'` (`app/(tabs)/profile.tsx:76`) and one API route reads `role === 'admin'` (`api/admin/compute-quality-scores/route.ts:86`) — both dead branches in the absence of manual SQL.
8. **The `'designer'` role is unreachable.** It exists only in `profiles.connect_roles[]` (`okujiKobo/lib/roles.ts:9`), and no code writes that array.
9. **Institutional-manager via `institutions.id = auth.uid()` is unreachable.** The pattern requires an `institutions` row whose primary key equals an auth UUID; no code path produces such rows. The RLS policies `emp_auth_manager_read`, `emp_auth_manager_write`, `emp_auth_manager_delete`, and `emp_auth_self_update` all depend on this pattern (`okujiKobo/supabase/migrations/014_blockpoint6.sql:104-156`); they are dead code unless an operator runs SQL.
10. **`emp_auth_self_update` is misnamed.** The policy's USING clause does NOT allow an employee to update their own row — it only permits admins, the issuing manager, or the manager-pattern institution. An employee cannot toggle their own capability flags via RLS. (`014_blockpoint6.sql:148-156`.)
11. **`institutions_admin_read` is redundant** with `institutions_public_read` after migration 026.
12. **Mobile employee terminal reads the OLD `employee_accounts` table**, not `employee_authorizations`. `app/employee/_layout.tsx:57-66` and `hooks/useEmployee.ts:6-25` query a pre-Connect-era schema. The mobile `EmployeeContext` (used by Field tab and capability detection) uses the new schema. **The mobile app has two parallel notions of "employee status" that don't agree.** If the live database doesn't have `employee_accounts` rows, the terminal silently shows "No active employee account found" even for users who are valid employees on the new schema.
13. **`'Design Certified' badge** scaffolding exists but is hardcoded to `false`. (`okujiKobo/app/explore/page.tsx:276`.) Either remove or build the certification flow.

### Schema confusion

14. **Three migration trees disagree.** `supabase/migrations/` (mobile), `okuji-db/supabase/migrations/` (consolidated baseline), and `okujiKobo/supabase/migrations/` (web ALTERs) define overlapping but non-identical `profiles` shapes. Differences: `family_id` (in mobile only), NOT NULL on `display_name` (mobile yes, baseline no), presence of `is_platform_admin` and `connect_roles` (web/baseline yes, mobile no). Which tree is canonical in production needs human confirmation; the README already calls this out.
15. **Mobile-baseline RLS policies coexist with web RLS policies.** Migration 012 DROPs and re-creates policies under new names but does not drop the names used by the mobile baseline. On a database bootstrapped from the mobile baseline, both name-sets exist; PostgreSQL OR's them, so the union of permissions applies. Not a security hole today (the policies are similar enough), but it makes the policy list very confusing.

### Inconsistency

16. **Three different admin tests in code.** `is_platform_admin()` RPC (most surfaces), `profile.role === 'admin'` (one API route), `connect_roles.includes('platform_admin')` (one access page). A correctly-provisioned admin needs the boolean column set AND, for the legacy quality-scores route, also `role='admin'`.
17. **Inconsistent capability checks across employee-facing routes.** `/api/token/*` requires specific flags; `/api/analytics`, `/api/institutions/[id]` PATCH, and `/api/passports/[id]/print-pdf` accept any `employee_authorizations` row. There is no "view-only" tier of capability — the flags appear designed per-action but several routes ignore them.
18. **Web and mobile disagree on "employee."** Web's `lib/roles.ts:69` treats ANY `employee_authorizations` row as an employee. Mobile's `EmployeeContext.tsx:75` requires `can_verify = true`. A user with `can_verify=false, can_distribute_prizes=true` counts as employee on web (shows the institutional dashboard) but not on mobile (Field tab hidden, terminal denies access).

### Bootstrapping and lifecycle

19. **No invitation flow.** To add an employee, the invitee must already have a Supabase account. There is no email-send-invite, no pending-invitation status.
20. **No promotion flow.** Promoting a user to platform admin, designer, or creator requires direct SQL — there is no UI, not even an admin-only one.
21. **Multi-institution employees cannot switch institutions.** `.limit(1).single()` picks one arbitrarily in both `manage/layout.tsx:101-108` and mobile `EmployeeContext.tsx`. A real, observable bug.
22. **`employee_authorizations` defaults to `(true, true, false)`** for inserts that don't set the flags. The UI overrides these explicitly, but any SQL or off-path insert defaults to a verifying + distributing employee. Footgun.
23. **The platform-admin "first institution" rendering is non-deterministic.** No ORDER BY. With multiple institutions, a given admin lands on whichever Postgres returns first.

### Documentation and naming

24. **`role_label` on `employee_authorizations` is purely display.** A reader of the schema might assume it has authorization meaning. It does not.
25. **The `okuji_active_role` cookie is `HttpOnly: false` by deliberate choice** ("needs to be readable by client for optimistic updates"). Worth knowing for anyone auditing; not a security concern given the cookie is cosmetic.

---

## Section 7 — Questions for the design conversation

These are the decisions the current code does not make for us. Each one needs a product answer before a target-state design can be drawn.

### Roles and entry paths

1. **Should "creator" remain implicit (every user can publish) or become an explicit role with an entry path?** Today every authenticated user is implicitly a creator. The `creator_is_certified` scaffolding suggests a planned approval flow; you have to decide whether that was the right idea.
2. **Is the institutional-manager-as-auth-user pattern (institution UUID = manager UUID) intended to stay, or should "manager" become a `can_manage_*` flag on `employee_authorizations`?** The current pattern is unreachable through the UI; the policies that depend on it are effectively dead.
3. **Is `'designer'` a real role you want to ship, or should it be removed?**
4. **Should `profiles.role`'s legacy values (`creator`, `employee`, `admin`) be retired from the CHECK constraint, or kept as a parallel mobile-app gate?**
5. **Should there be an invitation flow** (send email → invitee accepts → row inserted), or is "invitee must already have an account" the intended permanent UX?
6. **Should platform admin be a single boolean, or are tiers (super-admin, support, read-only support) wanted?**

### Capability flags

7. **Is `(can_verify=true, can_distribute_prizes=true, can_add_extras=false)` the right *default* row?** Or should defaults be `false, false, false` and the manager always opts in?
8. **Do you want capability flags for the currently-uncovered actions: `can_edit_institution`, `can_manage_employees`, `can_view_analytics`?** Today each is gated as "any employee row" — which is the weakest possible gate.
9. **Should `can_add_extras` be enforced by RLS as well as the API layer?** Today it's API-only, bypassable via direct PostgREST.
10. **Multi-institution employees — should the UI let them pick which institution they're acting for, or should the design assume one-institution-per-user?**

### Audit and access surfaces

11. **Should every "view" surface (analytics, print-pdf, institution metadata) require an explicit flag, or is "membership = view rights" sufficient?**
12. **What should `/api/employees/lookup` actually do?** Today it leaks email-existence to any signed-in user. Options: restrict to platform admins + managers of the same institution; replace with an invite-by-email flow that doesn't reveal existence.
13. **Should institutional employees ever be able to edit `passports` rows owned by their institution?** Today they cannot — only the `creator_id` user can — which works if creator and manager are the same person but breaks if you separate them.

### Mobile/web parity

14. **Should the mobile employee terminal migrate from `employee_accounts` to `employee_authorizations`?** Today the terminal is wired to the OLD schema while Field tab uses the new one — two notions of "employee" coexist.
15. **Should the legacy mobile `profile.role === 'employee'` check be removed in favor of the capability check?**

### Schema and migration hygiene

16. **Decide on a canonical migration source** for greenfield deploys. The README acknowledges this is undetermined. Either `okuji-db/supabase/migrations/000_baseline.sql` (consolidated) or the mobile-first chain (`supabase/migrations/`) plus web ALTERs (`okujiKobo/supabase/migrations/`) should be designated authoritative.
17. **Should the redundant mobile-vs-web RLS policy pairs (`passports_creator_manage` vs `passports_creator`, etc.) be cleaned up** to leave only one set?
18. **Should the redundant `is_admin()` wrapper be deprecated** now that it's literally a one-line alias of `is_platform_admin()`?

---

*Document end. Code references throughout cite file paths at HEAD of `claude/fervent-gates-1xa4b` as of 2026-05-30; line numbers may drift as the code moves.*
