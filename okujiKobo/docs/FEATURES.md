# okujiKobo — Features Rundown

A reviewable inventory of what the okujiKobo web app (creator / operator
surface) does today. Split into **Passport Designer** features and the
broader **Management** features, followed by an honest **Incomplete / not
yet implemented** section.

> Scope note: this documents the okuji web product (okujiKobo). The mobile
> collector app and the deferred moichido product are only referenced where
> the web app touches them. Internal Shuin naming applies per `CLAUDE.md`.

---

## 1. Passport Designer

The designer is the core authoring tool — where a creator builds the
physical-feeling passport collectors will stamp.

### Canvas & structure
- **Page-based passport model.** A passport is an ordered set of pages
  (`passport_pages`, soft-closed via `closed_at`), each carrying stops and
  imagery. Cover, inside-cover, content pages, and back/journal pages.
- **Drag-and-place canvas** (`components/design/Canvas.tsx`) for positioning
  stamp slots and (moichido) punch slots, with absolute coordinates persisted
  per element.
- **Passport-spec artboards** (`lib/print/passport-spec.ts`,
  `lib/assets/kinds.ts`): the US/ISO passport size (ISO/IEC 7810 ID-3) —
  page 612×869 (88×125 mm portrait), covers 1252×869 full wraparound
  (back · spine ≈4 mm · front ≈180 mm), stamps 1:1, page images native
  ratio with object-contain. Dimensions are not user-adjustable by design.
- **Right inspector** (`components/design/RightInspector.tsx`) for editing the
  selected element / stop — name, type, verification, location.

### Stops & verification
- **Canonical stop model**: `experience_type` + `experience_verification_method`
  (`gps` | `qr` | `witnessed` | `documented` | `honor`) is the source of truth;
  `verification_tier` is derived by the migration-046 sync trigger and never
  written directly.
- **Stop types in the inspector**: Location stops (GPS/QR verified) vs.
  Event/Activity stops (honor-based). Switching a Location → Event clears any
  stale `qr_code_id` on the spot (`handleTypeChange`), backstopped by a
  one-time data migration (087) for stops converted before that shipped.
- **Map location picker** (`components/design/MapPickerDialog.tsx`): Google
  Maps JS picker; confirming a pin reverse-geocodes server-side
  (`/api/maps/reverse-geocode` → `GOOGLE_MAPS_SERVER_KEY`) and writes
  lat/lng + a human-readable address back onto the stop.

### Stamp design
- **Stamp composer** (`components/design/StampComposer` / `StampPicker`):
  build a stamp from shapes + text, choose from new shape options, text
  justification/`textPath` layout, or upload a custom stamp image.
- **Assets library integration**: stamps and imagery are backed by the
  uploaded-assets system (rename, usage tracking).

### Printing & QR (operator handoff)
- **Print to PDF** (`/api/passports/[id]/print-pdf`): server-rendered
  (`@react-pdf/renderer`) printable passport. Footer carries the absolute
  `https://okujikobo.okuji.app` URL. (Formerly mislabeled "Print posters" in
  the menu.)
- **Print QR codes** (`/api/passports/[id]/qr-sheet`): generates a printable
  PDF sticker sheet (2×4 per Letter page, dashed cut borders) of stable QR
  codes for every QR-verified stop. Each code encodes the *exact* mobile
  scanner payload (`generateQrPayload(stopId, qrCodeId)` — see
  `lib/qr-payload.ts` drift-guard). Missing tokens are provisioned via the
  canonical `provision-qr-token` edge function. Surfaced in the passport ⋯
  menu and **disabled when the passport has no QR stops**.

### Publishing
- **Publish checklist** (`lib/design/publish-checklist.ts`): pre-publish
  validation, including a `verification_tier` fallback for pre-046 rows.
- **Publish / unpublish / republish** flows
  (`/api/passports/[id]/{republish,unpublish}`), with diff categorization on
  republish so collectors get correction notices where appropriate.

### moichido punch designer (web authoring built; runtime deferred)
- **Punch slots** on the canvas with optional **snap-to-grid**
  (`lib/design/punch-grid.ts`, `PunchGridContext`) — toggle + adjustable grid
  size in `CardWorkspace`.
- **Card-level punch mark**: choose an emoji/icon or "Design a custom punch"
  which reuses the StampComposer (`CardPunchShape.tsx`). Persisted via
  `punch_type` / `punch_icon` / `punch_asset_id` (migration 086).
- Note: this is **designer-only**. moichido's punch-consume runtime (Slice 3)
  is not built — see below.

---

## 2. Management features

Operator/creator management lives under the institutional shell and the
broader app. Most of the day-to-day operator hub is the tabbed **/program**
(institutional) area plus the dashboard.

### Dashboard
- **Operator dashboard** (`app/dashboard`): top-line program health.
  Honest-data only — dormant KPIs render at honest zero with a
  "tracking coming soon" / "Phase 2" treatment (`lib/dashboard/flags.ts`),
  never illustrative numbers.

### Program hub (tabbed)
- **Overview / Passports** — manage the institution's passports
  (`MyPassportsTable`): per-passport ⋯ menu (Print to PDF, Print QR codes,
  manage, etc.).
- **Employees** (`/manage/employees`, `/api/employees`): authorize staff at an
  institution via `employee_authorizations` (e.g. `can_design`). Capability
  enforcement is partial (see incomplete notes).
- **Prizes** (`/manage/prizes`): prize configuration for completion.
- **Analytics** (`/manage/analytics`, `/api/analytics/[passportId]`):
  aggregate-only insight — "how many and when, never who." Counts, rates,
  timestamps; no per-collector identity. Several panels are honest-zero
  Phase-2 placeholders.
- **Terminal** (`app/(institutional)/terminal`): in-venue terminal surface.

### Passport management page
- **Per-passport manage page** (`/manage/passport/[id]`): the post-publish
  home for a single passport.

### Marketplace & discovery
- **Marketplace** (`app/(marketplace)`): public listings — creator pages
  (`creator/[id]`), the stamp/passport **library**, passport detail
  (`passport/[id]`), and **share links** (`share/[token]`,
  `/api/share/render`). Shuin/internal naming never appears on these
  collector-facing surfaces.

### Stops library & assets
- **Stops library** (`app/stops`): reusable stop catalog — 3-tab grid +
  drawer, kudos, import recording, with comments/acknowledge
  (`/api/stops/[id]/comments`, `/acknowledge`).
- **Assets** (`app/assets`, `/api/assets`): upload, rename, usage tracking for
  imagery and stamps.

### Transfers
- **Transfers** (`app/transfers`): passport ownership / transfer flows.

### Access & administration
- **Single admin gate**: `is_platform_admin()` (SECURITY DEFINER RPC) is the
  only admin check; client roles derive from it via `detectRoles`.
- **Access area** (`app/access`): comp-subscriptions, institutions, and an
  admin **inspect** view (`access/inspect/[passportId]`).
- **Admin APIs** (`/api/admin`): user management, retention, quality-score
  compute.
- **Single subscription mechanism**: Pro/Studio access is granted only via
  `public.comp_subscriptions`; `profiles.{pro,studio}_*` are read-only
  trigger-propagated mirrors.

### Account, profile, billing
- **Profile** (`app/profile`), **account close** (`/api/account/close`, with
  the migration-049 cascade as the sole acquisition-deletion path), and
  billing/checkout (`/api/checkout`).

### Notifications
- **Notify hooks** (`/api/notify`): comp-grant and completion notifications.

---

## 3. Incomplete / not yet implemented

Honest status of the soft spots, so review is grounded:

- **moichido runtime (Slice 3) — not built.** The punch designer authors
  cards, but the runtime punch-consume / QR-consume path (e.g. nullable
  `punches.stop_id`, terminal punch flow) is not implemented. moichido stays
  designer-only in this repo per `CLAUDE.md`.
- **Dormant dashboard KPIs.** Several dashboard metrics intentionally render
  honest-zero with a "tracking coming soon" / Phase-2 treatment rather than
  real queries — by policy, not oversight.
- **Phase-2 analytics panels.** Some analytics surfaces are honest-zero
  placeholders pending the underlying tracking.
- **Back/journal pages are screen-only.** The back-pages journal layout is not
  yet represented in the print-PDF output.
- **Stamp-composer `textPath` fallback in PDF.** Curved/`textPath` text may
  fall back to a simpler rendering inside the print PDF vs. the canvas.
- **Partial employee-capability enforcement.** `employee_authorizations`
  capabilities (e.g. `can_design`) are defined and checked in key paths but
  not yet enforced uniformly across every operator action.
- **TypeScript baseline: ~54 pre-existing `tsc --noEmit` errors.** A known
  baseline (down from 148 after the `@supabase/ssr` upgrade + generated DB
  types). "No new errors" is verified by holding the count and confirming
  touched files don't appear.
- **Optional `jimp`** dependency carries an ambient declaration; image
  processing degrades gracefully when absent.
- **QR end-to-end scan test pending.** The print → scan → verify-stamp loop is
  implemented but has not had a full end-to-end in-app verification pass.

---

> Build-verified ≠ Nathan-verified. A green `tsc --noEmit` and a successful
> push do not equal "shipped working" — the in-app pass is the verification
> gate.
