# Okuji — Internal Technical Reference

> **Naming note**: The product is being rebranded to **Okuji**. The codebase, database tables, environment variables, and npm package names still say **Panoply** throughout. No code rename has been performed yet; this document uses "Okuji" for the product and "Panoply" when referring to specific code identifiers.

---

## 1. What Is Okuji

Okuji is a physical-world passport platform. A **passport** is a printed booklet that visitors collect at real-world stops (museum galleries, trail markers, cultural sites, storefronts). At each stop a visitor taps their phone, the app verifies they are physically present, and it stamps their digital passport. Completing a passport can unlock prizes, certificates, or educator-assigned rewards.

The system has three distinct user populations:

- **Visitors / collectors** — use the mobile app to discover and stamp passports
- **Institutional managers / individual creators** — use PanoplyConnect to manage passports, distribute them to employees, and view completions
- **Designers** — use PanoplyDesigner to lay out passport pages, position stamp boxes, and publish passports

---

## 2. Monorepo Layout

```
PanTest/                         ← repo root; also the Expo mobile app
├── app/                         ← Expo Router screens (visitor-facing)
├── components/                  ← React Native UI components
├── hooks/                       ← Custom React hooks (useStamp, etc.)
├── lib/                         ← Shared utilities (stamp.ts, gps.ts, roles.ts …)
├── types/index.ts               ← All TypeScript interfaces for the mobile app
├── supabase/
│   ├── functions/               ← Deno edge functions
│   └── migrations/              ← Numbered SQL migrations for mobile schema
├── PanoplyConnect/              ← Next.js 14 B2B portal (separate app)
│   ├── app/                     ← App Router pages
│   ├── lib/                     ← Connect-specific utilities
│   └── supabase/migrations/     ← Additional migrations for Connect tables
├── PanoplyDesigner/             ← Next.js 14 creator tool (separate app)
│   └── app/                     ← App Router pages
└── docs/
    └── CLAUDE_CODE_HANDOFF.md   ← Wireframe notes for Employee Terminal & Designer v1
```

All three apps share one Supabase project. PanoplyDesigner may have its own separate Supabase project for its working state (not confirmed).

---

## 3. Technology Stack

| Layer | Mobile App | PanoplyConnect | PanoplyDesigner |
|---|---|---|---|
| Framework | Expo ~54 / React Native 0.76.9 | Next.js 14.2 (App Router) | Next.js 14.2 (App Router) |
| Styling | NativeWind ^4 (Tailwind) | Tailwind CSS | Tailwind CSS |
| State | React hooks + Zustand | Zustand | React state |
| Database | Supabase JS ^2.43 | Supabase SSR | Supabase (own client) |
| Auth | Supabase Auth | Supabase SSR + middleware | Supabase Auth |
| PDF | — | @react-pdf/renderer ^4.5 | @react-pdf/renderer ^3.4 |
| AI | — | — | @anthropic-ai/sdk ^0.39 |
| Payments | — | Stripe | — |
| Email | — | Resend | — |
| Validation | — | Zod | — |
| Error tracking | Sentry ^5.22 | — | — |
| Maps | react-native-maps 1.18 | — | — |

---

## 4. Database Schema

All tables live in the `public` schema of a single Supabase project.

### Core tables (migration 001)

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user; holds `role`, `connect_roles[]`, display name, avatar |
| `proprietors` | Institution/business records linked to a profile |
| `passports` | The passport definition; `creator_id`, `is_published`, title |
| `passport_pages` | Ordered pages within a passport; `page_type` (`stamp`/`information`), `section_name`, `section_title` |
| `stops` | Individual stamp locations on a page; `box_x`, `box_y`, `box_width`, `box_height` (absolute px on the 612×792 artboard); `stop_order` |
| `collector_passports` | Join between a visitor profile and a passport they have acquired |
| `stamps` | A completed stamp event; references `stop_id`, `collector_passport_id`; stores `geohash` (precision 6) |
| `journal_entries` | Free-text reflections attached to a stamp |
| `redemption_tokens` | Prize/certificate codes with `token_code` (MCM-XXXX-XX format) |

PostGIS is enabled. A `verify_radius` function checks whether submitted GPS falls within a stop's configured radius.

### Accolades (migration 003)

`accolades`, `reading_recommendations`, `teacher_notes` — educator-facing enrichment attached to stops.

### Stamp slots (migration 004)

`stamp_slots` — designer-only layout elements that position stamp boxes on a page using **percentage** coordinates (`pos_x`, `pos_y`, `width_pct`, `height_pct`). These are separate from the absolute-pixel `box_x/y/width/height` fields on `stops` which the mobile app and PDF renderer use.

### Connect tables (PanoplyConnect/supabase/migrations/002)

| Table | Purpose |
|---|---|
| `acquisitions` | Tracks passport distribution to end visitors via institutional channels |
| `presence_sessions` | Employee check-in sessions for Tier 4 verification |
| `mood_ratings` | Optional visitor mood capture per stamp |
| `completion_tokens` | Tokens generated on page completion; linked to `redemption_tokens` |
| `journeys` | Named thematic groupings of passports |
| `share_tokens` | Public share links for passports |
| `institution_subscriptions` | Stripe subscription state per institution |
| `prize_configurations` | Prize rules per passport |
| `employee_authorizations` | Which employees are authorized for which passports |

---

## 5. Authentication & Roles

### Session handling

PanoplyConnect's middleware calls `supabase.auth.getSession()` (no network call, reads the cookie) for routing decisions. The actual security check (`getUser()`) happens in server components / layouts running in Node.js. This is intentional — `getUser()` makes an outbound Supabase call that fails unreliably in the Edge Runtime.

### Role detection (`PanoplyConnect/lib/roles.ts`)

Five roles are detected at runtime, not stored in a single column:

| Role | Detection method |
|---|---|
| `platform_admin` | `profiles.role === 'admin'` |
| `individual_creator` | `profiles.role === 'creator'` |
| `institutional_manager` | `institutions.id === auth.uid()` — the institution row's PK is the user's auth UID |
| `institutional_employee` | Entry in `employee_authorizations` table |
| `designer` | `profiles.connect_roles` array contains `'designer'` |

The `institutional_manager` detection is notable: the institution record IS the user's auth record. There is no separate join table — the institution's `id` equals the user's UUID.

---

## 6. Core Stamp Mechanics

### State machine (`hooks/useStamp.ts`)

Each stamp slot cycles through four states:

```
dormant → ready → pressing → stamped
```

`dormant`: stop not yet accessible. `ready`: visitor is in range and stamp is available. `pressing`: touch is held down (gesture in progress). `stamped`: stamp has been recorded.

### Press-to-stamp gesture

The gesture holds the `pressing` state while the user maintains finger contact. On release with sufficient dwell time, `completeStamp()` is called, which calls `saveStamp()` in `lib/stamp.ts`.

### LocationBox dual function

The `box_x/y/width/height` fields on a `stop` serve two purposes:
1. In the designer — the visual bounding box drawn on the artboard
2. In the mobile app and PDF renderer — the region the visitor must interact with

### Center-within / edges-free rule (`lib/stamp.ts`)

`computeStampPlacement()` returns `null` if the user's touch center falls outside the LocationBox. The stamp edges may overflow the box — only the center point is constrained. If center is outside box, no stamp is placed.

### Contact-size-to-stamp-size scaling (`components/passport/StampCanvas.tsx`)

```typescript
const stampSize = (stamp.contact_size_px ?? 60) * 1.1
```

The rendered stamp diameter is 110% of the contact footprint recorded at stamp time. A larger finger produces a larger ink mark.

### Stamp artwork (`components/stamp/StampArtwork.tsx`)

SVG renderer with four shape variants: `circle`, `rectangle`, `hexagon`, `badge`. Applies a smudge SVG filter to mimic ink imperfection.

---

## 7. Location Verification

### Five tiers (`supabase/functions/verify-stamp/index.ts`)

| Tier | Method | Confidence |
|---|---|---|
| 1 | GPS within radius **and** valid QR scan | Precise |
| 2 | Valid QR scan **and** property-level GPS match | High |
| 3 | GPS within configured radius only | Medium |
| 4 | Employee manually verified (visitor code shown to staff) | Staff-attested |
| 5 | Honor system (no verification) | Unverified |

### GPS privacy

Precise coordinates are **never stored**. After verification, the edge function converts the coordinate to a 6-character geohash (~1.2 km resolution) and stores only that. `lib/gps.ts` requests foreground permissions only — no background location access.

### Visitor code flow

For Tier 4, `app/passport/stamp/[stopId].tsx` shows a short visitor code modal. The visitor reads this code to an on-site employee. The employee enters it in the Employee Terminal in PanoplyConnect to authorize the stamp.

---

## 8. Mobile App (Expo)

Entry point: Expo Router at `app/`. Key screens:

- `app/passport/stamp/[stopId].tsx` — Primary stamp screen; QR-triggered or deep-linked
- `app/(tabs)/explore/` — Public passport discovery
- `app/passport/[id]/` — Visitor's passport view with stamp canvas overlay

Key libraries: `expo-camera` for QR, `expo-location` for GPS, `react-native-maps` for map views, `expo-haptics` for stamp feedback, `@react-native-voice/voice` for voice input (scope unclear), `expo-speech` for audio output (scope unclear).

Sentry is integrated for crash reporting (`@sentry/react-native ^5.22`).

---

## 9. PanoplyConnect — Institutional Portal

Next.js 14 App Router. Route groups:

- `(institutional)/manage/` — Passport management, analytics (stub), distributions
- `(institutional)/employees/` — Employee roster and authorization
- `(individual)/` — Individual creator flows
- `admin/` — Platform admin views
- `explore/` — Public passport discovery (no auth required)
- `share/[token]/` — Public share link landing pages

### Dashboard (`app/page.tsx`)

Six navigation cards. Role-sensitive metrics: platform admins see system-wide counts; institutional managers see their institution's acquisition and completion data. Alert system surfaces two conditions: pending distributions (acquisitions without recipients) and stops missing GPS coordinates.

### Analytics

`app/(institutional)/manage/analytics/page.tsx` is a stub: "Detailed reporting coming soon." No data pipeline exists yet.

### Stripe integration

`institution_subscriptions` table tracks plan state. Stripe webhooks presumably update it. The full billing flow is not confirmed implemented end-to-end.

### Debug routes

`/api/auth-debug` and `/api/middleware-debug` routes are present in the codebase. These should be removed before any public deployment.

---

## 10. PanoplyDesigner — Creator Tool

Next.js 14. Uses `@anthropic-ai/sdk ^0.39` — Claude is integrated for some creator-assistance feature (exact scope not fully mapped; likely copy generation or layout suggestions).

The artboard is **612 × 792 px** (matching US Letter at 72 DPI). This is the canonical coordinate system for all `box_x/y/width/height` values stored in `stops`.

Designers position `stamp_slots` (percentage-based) and `stops` (absolute px). These two coordinate systems are parallel — `stamp_slots` drives the visual layout tool; `box_x/y` on `stops` is what the mobile app and PDF renderer consume.

---

## 11. Edge Functions (Deno)

Located at `supabase/functions/`.

### `verify-stamp`

Accepts: `stop_id`, `collector_passport_id`, GPS coordinates, optional QR token. Runs tier logic, discards GPS after geohash computation, inserts to `stamps` table. Returns tier achieved.

### `generate-token`

Called on passport page completion. Generates a token in MCM-XXXX-XX format and inserts to `redemption_tokens`. `lib/token.ts` on the mobile side calls this function; it also contains a `journalEncryption` stub marked "Scaffold for Year 2 zero-knowledge" — not implemented.

---

## 12. PDF Generation (Print-for-Kids)

Route: `PanoplyConnect/app/api/passports/[id]/print-pdf/route.tsx`

Uses `@react-pdf/renderer` server-side via `renderToBuffer()`. Produces a portrait 8.5"×11" PDF (612×792 pt) where each sheet holds **two slots** — cut along y=396, fold guide at x=306.

### Slot model

Each slot represents one **passport page** (not one stop). The slot renders a miniaturized view of the full 612×792 artboard scaled to fit within the slot area.

Key constants:
```
ARTBOARD_W = 612    ARTBOARD_H = 792
SLOT_W = 612        SLOT_H = 396       CUT_Y = 396
CANVAS_SCALE ≈ 0.440                   (CANVAS_AREA_H / ARTBOARD_H)
CANVAS_W ≈ 269 pt   CANVAS_H ≈ 348 pt
```

### LocationBox rendering

Each stop's `box_x/y/width/height` (artboard pixels) is multiplied by `CANVAS_SCALE` to produce positioned `<View>` elements within the scaled canvas. The stop name appears inside the box.

### Imposition order

Cover → passport pages (one per slot) → Certificate. Padded to even slot count with a blank slot if needed. Registration marks: two crosshairs only, at (0, CUT_Y) and (612, CUT_Y).

### Stop filtering

The `stop_ids` query parameter filters which pages appear. A page is included if any of its stops is in `stop_ids`. Information pages are always included. Empty `stop_ids` includes all pages.

### Supabase type workaround

Tables added after the initial TypeScript types were generated return `never` from the Supabase client. All new table queries use `(supabase as any).from('table_name')` with explicit return type annotations.

---

## 13. Environment Variables

### Mobile app (root `.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry project DSN |

### PanoplyConnect (`PanoplyConnect/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email key |

### PanoplyDesigner (`PanoplyDesigner/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (may differ) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `ANTHROPIC_API_KEY` | Claude API key |

---

## 14. Supabase Setup & Migrations

Migration numbering is split across two locations:

- `supabase/migrations/001–004` — mobile + shared schema (passports, stops, stamps, stamp_slots, accolades, etc.)
- `PanoplyConnect/supabase/migrations/002` — Connect-specific tables (acquisitions, presence_sessions, etc.)

To apply: `supabase db push` from the repo root for mobile migrations; equivalent command from `PanoplyConnect/` for Connect migrations. Confirm with `supabase migration list` that all migrations show as applied before deploying edge functions.

Edge functions are deployed with `supabase functions deploy <function-name>`.

---

## 15. Development Workflow

```bash
# Mobile app
cd /path/to/PanTest
npx expo start

# PanoplyConnect
cd PanoplyConnect
npm run dev          # port 3000

# PanoplyDesigner
cd PanoplyDesigner
npm run dev          # port 3001 (or as configured)

# Type-check mobile
npm run type-check

# Lint mobile
npm run lint
```

There is no root-level script that starts all three apps simultaneously. Each must be run in a separate terminal.

---

## 16. Open Questions & Known Gaps

### Coordinate system split

`stamp_slots` (migration 004) uses percentage-based positioning (`pos_x`, `pos_y` as 0–100). `stops` uses absolute artboard pixels (`box_x`, `box_y`). It is unclear which system the designer writes when a user drags a box — the code in PanoplyDesigner was not fully traced. These two systems may be redundant or may serve different purposes (layout grid vs. tap-hit-test region).

### Institutional manager identity

`institutions.id === auth.uid()` means the institution record IS the auth user. This means an institutional manager cannot have a separate personal identity — their user account IS the institution. This is an unusual pattern that may cause issues if an institution needs multiple admin-level users.

### Designer Supabase project

PanoplyDesigner has its own `package.json` and Supabase client configuration. It may connect to a separate Supabase project (not the shared mobile/Connect project). If so, passport data published from Designer must be synced or copied to the shared project — the mechanism for this is not visible in the codebase.

### Analytics

The analytics page in PanoplyConnect is a stub. No aggregation queries, materialized views, or reporting pipeline exists.

### Billing completeness

Stripe is wired in (`institution_subscriptions` table, Stripe SDK present) but the end-to-end billing flow — plan gating, subscription creation, webhook handling — is not confirmed fully implemented.

### `stamp_slots` vs. `stops.box_*`

It appears `stamp_slots` was added (migration 004) as a designer-facing layout primitive, but the verification and PDF systems read `stops.box_x/y/width/height`. There is no migration or code path that syncs `stamp_slots` positions to `stops.box_*`. This may mean stamp slots are purely visual scaffolding that does not feed into actual stamp verification.

### Voice and speech integrations

`@react-native-voice/voice` and `expo-speech` are listed as dependencies but no clear user-facing voice feature is present in the screened components.

### Journal encryption stub

`lib/token.ts` contains a `journalEncryption` object explicitly marked as a "Scaffold for Year 2 zero-knowledge." The encryption is a no-op. Journals are stored in plaintext.

### Debug routes

`PanoplyConnect/app/api/auth-debug/route.ts` and `/api/middleware-debug` are present in the codebase. They must be removed or protected before production deployment.

### `supabase as any` proliferation

Multiple tables lack TypeScript type coverage in the generated Supabase client. Any query to a newer table requires the `(supabase as any)` cast. Running `supabase gen types typescript` and updating `types/supabase.ts` would eliminate this.

### Rebrand (Panoply → Okuji)

No code has been renamed. Every package name, table name, CSS class prefix (`panoply-`), component name, and route (`/creator/`) still uses "Panoply." The rebrand is pending a coordinated rename pass across all three apps.
