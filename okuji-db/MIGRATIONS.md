# Okuji Database — Migration Directory

## How to use this document

This is a plain-language guide to the Okuji database. Read it to understand
what the database contains and why — without reading SQL. Updated every time a
new migration is added.

For new database setup, run `000_baseline.sql` only. Do not run archived migrations
on a fresh database. Future incremental changes go in numbered files starting at `001_`.

---

## 000_baseline.sql

**Created:** 2026-05-06
**Status:** Baseline — run once on a fresh database only
**Purpose:** Complete Okuji schema as of Blockpoint 3. Consolidates migrations
002 through 011 into one authoritative file.

---

### Core tables

**profiles**
One record per user. Created automatically by the `handle_new_user` trigger when
someone signs in for the first time. Stores display name, avatar URL, bio, date of
birth, traveler personality type, Stripe Connect account (for creator payouts),
auth provider (email or Google), additional Connect roles beyond the basic role,
and the platform admin flag (`is_platform_admin`). The `is_platform_admin` flag
gives full read/write access to every table — set only on the founder's account.

**institutions**
Organisations that use okujiKobo — schools, libraries, nature centers, McMenamins
hotels, tourism boards, etc. Each institution has a type (from a 35-value list spanning
educational, environmental, cultural, social, commercial, and legacy categories), a
pricing model (free forever, paid passport, subscription tiers), and an admission flag
for nature/science institutions that charge entry fees. Institutions are linked to
profiles through `employee_authorizations`.

**passports**
The top-level passport record. Contains the passport title, description, cover design
data (stored as JSON for the front/back and inside faces), expected spend tier, status
(draft / published / archived), and creator attribution. A passport belongs to either
an individual creator or an institution (`proprietor_id`). Passports also store print
settings for the physical print-for-kids feature.

**passport_pages**
A passport has one or more pages. Each page has a background design (guilloche pattern,
landscape, or custom), a paper color, and an array of freely positioned text/line elements.
Pages can be either stamp pages (collectors visit and earn stamps) or information pages
(text and images only, no stops). `page_order` controls display sequence.

**stops**
Individual locations or experiences on a passport page. Each stop has address and GPS
data, a stamp graphic (emoji or custom uploaded asset), ink color, verification settings
(GPS radius, QR code), a draggable bounding box for the canvas layout, and educational
metadata (classifiers, grade levels, subject areas). Stops can be shared with the
community stop library when `is_shared = true` (institutional accounts only).

**design_assets**
Custom stamps, background images, and cover images uploaded by creators or institutions.
Stores a URL to Supabase Storage, an optional thumbnail, the file format, and a
monochrome detection flag (`is_monochrome`). Monochrome stamps have the stop's ink color
applied at render time; multicolor stamps render in their original colors.

**stamps**
A collector's earned stamp at a stop. Records when and how the stamp was verified
(GPS presence, QR scan, witnessed by staff, or honor system), the physical position
and rotation of the stamp ink impression on the passport page, and the verifying
employee if applicable.

**acquisitions**
Records that a user has acquired a passport — either free or purchased. One row per
user/passport pair. Parallel to `collector_passports` in the Expo app.

**presence_sessions**
Foot traffic data: when a collector arrived at and departed from a stop. Used for
institutional analytics (Program Management) without touching private journal content.

**journal_entries**
Private collector reflections written or recorded after a stamp. Content is NEVER
used in analytics or AI training. Shared only when the collector explicitly opts in
through journey sharing terms.

**mood_ratings**
1–5 star ratings left by collectors after completing a stop. Feeds into the creator
quality score and Explore sort order.

**completion_tokens**
Generated when a collector completes all stops on a passport page. Presented at an
institution's counter to claim a prize. Tracks whether the prize has been distributed
and by whom.

**journeys**
Group passport experiences — multiple collectors sharing the same passport adventure
simultaneously. A journey has members and optional journal sharing terms.

**journey_members**
Who belongs to a journey, and in what role (owner or member).

**journal_sharing_terms**
Consent agreements within a journey. Controls when each member's journal entries
become visible to others: immediately, on a set reveal date, or never (private).

**share_tokens**
One-time links that allow non-users to view a published passport.

**institution_subscriptions**
Billing tier for each institution. Free institutions never pay. Commercial institutions
subscribe to community, regional, or enterprise tiers via Stripe.

**prize_configurations**
What prize an institution offers collectors who complete a specific passport page.
Includes prize description, approximate value, and optional location whitelist
(prize can only be claimed at certain stops).

**employee_authorizations**
Who can act on behalf of an institution in okujiKobo: verify stamps, distribute
prizes, or add extras to collector passports. Each authorization record specifies
which permissions the employee has.

**tips**
Voluntary tips from collectors to passport creators. 100% of the amount (minus Stripe's
processing fee) is transferred to the creator. Okuji retains zero.

**creator_quality_scores**
Computed quarterly by the quality score API. A composite of completion rate (30%),
average mood rating (30%), return visit rate (20%), and expert signoff rate (20%).
Drives the "quality" sort order on the Explore page.

**print_jobs**
Audit log for physical passport print requests. Institutional accounts can generate
printable PDFs for collectors at schools, libraries, etc. Each record captures what
was printed, how many copies, and who ordered it.

**passport_autosaves**
A rolling 10-save buffer of autosaves per passport. Created on a timer while the
designer is open. A trim trigger keeps only the 10 most recent saves. Used to recover
unsaved changes after an accidental close.

---

### Security model

Every table has Row Level Security (RLS) enabled. The general rules:

- **Creators** can read and write their own passports, pages, and stops. They can
  read stops on published passports (for the stop library).
- **Collectors** can read and write their own stamps, acquisitions, and journal entries.
- **Employees** can read completion tokens and stamps for their institution's passports.
  They can update tokens to mark prizes as distributed.
- **Institutional managers** can configure prizes and manage employee authorizations
  for their institution.
- **Published passports** are publicly readable so the Explore page works without login.
- **Platform admins** (is_platform_admin = true) bypass every restriction through
  the `public.is_admin()` helper function called in every policy. There is exactly
  one platform admin: the founder's account.

---

### Key relationships

```
auth.users ──► profiles
                 │
                 ├──► passports ──► passport_pages ──► stops
                 │                                       │
                 │                                       ▼
                 │                                  stamps (collector earns)
                 │
                 └──► employee_authorizations ──► institutions
                                                       │
                                                  prize_configurations
                                                  institution_subscriptions
```

A passport belongs to a creator (profiles) and optionally an institution (proprietor_id).
Stops live on pages, and pages live on passports. When a collector stamps a stop, a
stamps row is created linking their profile to the stop. Completion tokens link a
collector's progress to a specific page for prize redemption.

---

## 003_blockpoint6.sql

**Created:** 2026-05-06
**Status:** Current — applied to production
**Tables affected:** institutions, passports, employee_authorizations
**Why:** Three categories of change:

1. **Institution contact / address fields.** Adds `contact_name`, `contact_email`,
   `address_line1`, `address_city`, `address_state`, `address_zip`, `website`, and
   `internal_notes` columns to `institutions`. These support the Access Management
   institution detail view where platform admins can record contact info and notes
   for each institution without it being public-facing.

2. **Cover thumbnail.** Adds `cover_thumbnail` to `passports` to store the client-side
   composited cover image (base64 data-URI or storage URL) generated by the Cover
   Designer. Used by Explore cards and the My Passports list to show the fully rendered
   cover instead of the simpler fallback render.

3. **RLS policy improvements.** Updates `institutions_manager_write` to use
   `is_platform_admin()` so admins can create and manage any institution. Adds
   `institutions_admin_read` for full platform admin visibility. Replaces the
   `emp_auth_read` policy with more granular `emp_auth_manager_read`,
   `emp_auth_manager_write`, `emp_auth_manager_delete`, and `emp_auth_self_update`
   policies so institutional managers can add/remove/update employees in their own
   institution, and platform admins can manage all.

4. **Search indexes.** Adds GIN full-text index on `institutions.name`, and BTree
   indexes on `institution_type`, `tier`, and `employee_authorizations.institution_id`
   to support the Access Management search and filter UI.

---

## 002_blockpoint5.sql

**Created:** 2026-05-06
**Status:** Current — applied to production
**Tables affected:** profiles, employee_authorizations
**Why:** Two fixes:

1. **RLS recursion fix.** Adds `public.is_platform_admin()` as a canonical `SECURITY DEFINER`
   function that reads `profiles` as the function owner (postgres), bypassing RLS. This breaks
   the recursion chain that occurred when the `emp_auth_read` policy evaluated itself indirectly
   via `public.is_admin()`. The existing `public.is_admin()` alias is kept for backward
   compatibility. The `emp_auth_read` policy on `employee_authorizations` is replaced with a
   simpler version that uses only direct column comparisons (`user_id`, `authorized_by`) and the
   new SECURITY DEFINER function — no self-referential EXISTS subquery.

2. **Admin function alias.** `is_admin()` is updated to delegate to `is_platform_admin()` so all
   existing policies continue to work without modification.

---

## 001_blockpoint4.sql

**Created:** 2026-05-06
**Status:** Current — applied to production
**Tables affected:** profiles, passports, passport_pages, stops, stamps, presence_sessions,
journal_entries, mood_ratings, completion_tokens, journeys, journey_members,
journal_sharing_terms, institution_subscriptions, prize_configurations,
employee_authorizations, tips, creator_quality_scores, acquisitions, design_assets,
institutions, passport_autosaves, print_jobs
**Why:** Three categories of change:

1. **Platform admin flag.** Adds `is_platform_admin` to profiles and creates the
   `public.is_admin()` helper function. All existing RLS policies are dropped and
   recreated with the admin bypass clause so the founder can access every section
   of okujiKobo without restriction.

2. **Stamp asset system.** Adds `stamp_asset_id` and `stamp_type` columns to stops,
   allowing a stop's stamp to reference a custom uploaded image from `design_assets`
   instead of an emoji. Adds `is_monochrome`, `file_format`, `thumbnail_data`, and
   `is_built_in` columns to `design_assets` to support the monochrome ink color system
   and built-in stamp library.

3. **Design asset policies.** Adds an institution-scoped read policy so members of an
   institution can see their institution's shared stamp assets in the designer.

---

## 004 — Collector passport last_used_at

**Status:** Incremental

**Purpose:** Adds `last_used_at` (timestamptz, nullable) to `collector_passports`
so the mobile "My Passports" list can sort recently-used passports first, with
never-used ones falling to the bottom.

**Why:** "Used" means a stamp was recorded against that collector passport. The
migration (1) backfills `last_used_at` from the most recent existing stamp per
collector passport, and (2) installs an `AFTER INSERT` trigger on `stamps`
(`stamps_touch_last_used`) that bumps the owning collector passport's
`last_used_at` whenever a newer stamp is recorded.

---

*This document is maintained as part of the Okuji development process. Every new
migration must include an entry here before the PR is merged.*
