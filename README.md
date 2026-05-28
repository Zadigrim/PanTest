# Okuji

A monorepo containing two applications and a shared Supabase backend for creating, distributing, and collecting "passport" experiences: a React Native (Expo) mobile collector app and a Next.js web platform for creators and institutions.

> Naming note: the product documentation uses "Okuji," but the database SQL is branded "Panoply" throughout (`okuji-db/supabase/migrations/000_baseline.sql`), and the redemption-token prefix is hardcoded `MCM-` (McMenamins) in `supabase/functions/generate-token/index.ts`. These are the same product under different names. This README uses "Okuji."

## What's in this repo

- **Mobile app (Okuji)** — React Native + Expo (SDK 54, RN 0.81.5, React 19.1, expo-router 6) at the repo root. The consumer app: browse/acquire passports, place GPS/QR-verified stamps, keep a journal, and two staff modes (employee redemption terminal, field acknowledgment).
- **okujiKobo (web)** — Next.js 14 (App Router, React 18) in `okujiKobo/`. The creator/institutional platform: a visual passport designer (referred to as OkujiDesigner, implemented inside this app — there is no separate `OkujiDesigner/` directory), a marketplace, institutional management, an employee terminal kiosk, Stripe checkout, and print-to-PDF.
- **Backend** — Supabase Postgres. Two Deno edge functions (`supabase/functions/`) and SQL migrations spread across three directories (see Backend). The mobile schema uses PostGIS; the web schema does not.

Tech stack summary: Supabase (`@supabase/supabase-js`; `@supabase/ssr` on web), NativeWind/Tailwind, expo-router (mobile) / App Router (web), Stripe (web), Resend (web), Sentry (mobile, partially wired), Vercel Analytics (web).

## Architecture

The two apps are independent codebases that talk to the same Supabase project. There is no shared code package between them; they each have their own Supabase client, their own dependency tree, and their own migration history.

Data flow for the core loop (verified in code):

1. A creator builds a passport in either the web designer (`okujiKobo/app/design/[id]`) or the mobile designer (`app/designer/`). Both write directly to `passports`, `passport_pages`, and `stops`.
2. A collector acquires a passport. On web, `okujiKobo/components/marketplace/AcquireButton.tsx` writes both `acquisitions` and `collector_passports`. On mobile, `acquirePassport` writes `collector_passports`.
3. A collector stamps a stop in the mobile app (`app/passport/[id].tsx` or `app/passport/stamp/[stopId].tsx`). The client takes a momentary GPS reading and calls the `verify-stamp` edge function, then inserts the result into `stamps`.
4. When all stops on a page are stamped, the client calls `generate-token`, which inserts a `redemption_tokens` row and returns a `MCM-XXXX-XX` code.
5. Staff redeem that code in the mobile employee terminal (`app/employee/`) or the web terminal (`okujiKobo/app/(institutional)/terminal`).

A consequence of the two-schema split (see Backend) is that the edge functions are written against the mobile schema (`target_location`, `redemption_tokens`, the `check_gps_within_radius` RPC), and the web Stripe purchase path does not write `collector_passports`, so a passport bought via Stripe on the web does not currently appear in the mobile app through that path.

## Mobile app (Okuji)

Single Supabase client in `lib/supabase.ts`, reading `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; it throws at module load if either is missing. Sessions persist via AsyncStorage. There is no payment SDK in the mobile app.

### Authentication
- `app/_layout.tsx` centralizes the auth gate (redirects unauthenticated users to `/(auth)/login`, authenticated users in `(auth)` to `/(tabs)/my-passports`). Most screens also re-check `getCurrentUser()` on mount.
- `app/(auth)/login.tsx` — email/password (`signInWithPassword`) and Google OAuth (`signInWithOAuth` + `expo-auth-session`, redirect `okuji://auth`). A code comment states Google depends on external setup that is not in the repo.
- `app/(auth)/register.tsx` — `signUp`, then inserts a `profiles` row with `role: 'collector'`. No email-confirmation handling.

### Tabs (`app/(tabs)/`)
- **My Passports** — queries `collector_passports` joined to `passports`; renders cover thumbnails; marks completed passports.
- **Discover** (`index.tsx`) — toggles between Nearby and Catalogue. Nearby (native) is a real `react-native-maps` distance view; `NearbyMode.web.tsx` is a stub that shows "Map view available on mobile."
- **Profile** — loads/edits `profiles`; signs out. Note: this screen tells users that passport design "lives on okuji.app" and links out, even though a mobile designer exists.
- **Field** — a conditionally hidden tab, shown only when the user is an employee and employee mode is enabled.

### Passport, stamp, journal
- `app/passport/[id].tsx` — the book reader. Loads the passport, pages, stops, and the user's stamps; sends the user back if they do not own the passport. Stamp placement reads momentary GPS (`expo-location`), calls the `verify-stamp` edge function, inserts into `stamps`, then calls `generate-token` if the page is complete.
- `app/passport/stamp/[stopId].tsx` — standalone/deep-link stamp screen; requires location (unlike the book view). Shows a "visitor code" derived client-side as the first six characters of the user UUID.
- `app/journal/[stampId].tsx` — upserts `journal_entries`. Journal photos are resized client-side (long edge ≤ 3000px; HEIC uploaded as-is, never transcoded) and uploaded to the private `journal-photos` Supabase Storage bucket via an AsyncStorage-backed offline queue (`lib/journal-photos.ts`, `lib/journal-photo-queue.ts`); per-photo state lives in the `journal_photos` table (`pending` / `uploaded` / `failed` / `lost`), and the entry view renders the local file while the upload is pending and a cached signed URL once uploaded. Legacy `journal_entries.photo_urls` entries can be migrated on demand from Profile → "Back up older journal photos" (`lib/journal-photo-backfill.ts`). `components/journal/VoiceRecorder.tsx` provides on-device speech-to-text via `expo-speech-recognition` with `requiresOnDeviceRecognition: true` — audio is processed on the device, never sent to cloud services, and no audio file is written; if a device cannot do on-device recognition, voice is disabled (the user types instead) rather than silently falling back.

### Designer (`app/designer/`)
A working CRUD designer (lists/creates passports, edits sections, cover, theme, pricing, publish, and stop metadata — all real Supabase writes). Two wiring gaps make designer-authored content unusable for GPS stamping:
- The stop editor never sets a stop's GPS coordinate (`target_location`/lat-lng); the designer map's initial region is hardcoded to New York City.
- `stamp_slots` are created with `stop_id: null` and never linked to a stop.

Pricing fields (`is_free`, `price_cents`) are written but there is no payment integration in mobile, so "paid" passports are acquired for free.

### Employee mode (`app/employee/`)
A functional two-step audited redemption terminal: `expo-camera` QR scan or manual entry, `redemption_tokens` lookup, and a required redemption step that records distribution fields. `components/employee/PrizeDistribution.tsx` and `components/employee/TokenScanner.tsx` are complete but imported nowhere (the screens reimplement that logic inline).

### Field mode (`app/field/`)
A functional staff acknowledgment flow: scan an `OKUJI:{userId}:{stopId}` QR, look up the `stamps` row, insert a `presence_sessions` row, mark the stamp ready, and optionally grant an accolade or (library-only) a reading recommendation.

## okujiKobo (web)

Next.js 14 App Router. `next.config.js` sets `typescript.ignoreBuildErrors: true` (Supabase "never"-type errors), so the app builds despite type errors; the code uses many `(supabase as any)` casts.

### Authentication and gating
- `middleware.ts` requires login for all routes except an allowlist (`/login`, `/signup`, `/auth/`, `/share/`, `/explore`, `/passport/`, `/creator/`, `/_next`, `/api/`). It uses `getSession()` for routing and notes that server layouts run the authoritative `getUser()` check.
- `app/(auth)/login`, `app/(auth)/signup`, and `app/auth/callback/route.ts` (PKCE `exchangeCodeForSession`).
- Role switching (`components/layout/RoleSwitcher.tsx`, `app/actions/role.ts`) writes a cosmetic `okuji_active_role` cookie; it changes the active dashboard view, not permissions.
- The admin simulation overlay (`components/admin/AdminOverlay.tsx`, `lib/admin/simulation-context.tsx`) is in-memory only and affects a single consumer (the designer's stop-sharing gate).

### Marketplace and dashboard
- `app/page.tsx` — role-scoped dashboard metrics (real queries).
- `app/(marketplace)/library` — acquired passports with progress (uses RPC `get_stop_counts_for_passports`).
- `app/(marketplace)/passport/[id]` — passport detail. Institution attribution and quality/rating blocks do not render: `institution` and `quality_score` are hardcoded to `null`.
- `app/(marketplace)/creator/[id]` — aggregates creator quality scores.
- `app/(marketplace)/share/[token]` — public completion card.

### Institutional (`app/(institutional)/`)
- `manage/` dashboard, `manage/employees` (CRUD on `employee_authorizations`), `manage/prizes` (`prize_configurations`), `manage/passport/[id]` (analytics + token log). `manage/analytics` is a "coming soon" stub. Platform admins are auto-assigned the first institution.
- `terminal/` — a kiosk that scans tokens (dynamic `html5-qrcode` import), validates via `/api/token/validate`, and redeems via `/api/token/redeem`.

### OkujiDesigner (`app/design/`, `components/design/`)
A Zustand-backed desktop-only visual editor. Working: page add/reorder (dnd-kit)/delete; stop add/select/delete with box drag/resize; text/image/line elements persisted as a JSON `elements` array on `passport_pages`; a full stop inspector (verification tier/radius, address + lat/lng, stamp picker, `is_shared` toggle); cover designer; 30-second autosave plus Cmd/Ctrl+S; canvas-rendered cover thumbnail; a publish wizard with validation; and PDF export. Stop QR tokens are generated client-side as `OKUJI-<id>-<rand>` with `Math.random` (no server validation). The "use a template" option is disabled ("Templates coming soon").

`app/api/passports/[id]/print-pdf/route.tsx` produces a real N-up print booklet via `@react-pdf/renderer` (4 quadrants per 8.5x11 sheet, cut/registration guides, backgrounds and elements rendered, dashed location boxes). The `copies` value is logged to `print_jobs` but does not multiply the output.

### Other surfaces
- `app/explore` — public catalogue. Stop counts, quality scores, and "certified" status are hardcoded to zero/null/false, so those columns never display and the quality/most-completed sorts are inert.
- `app/access` — institution and user administration (admin/manager scoped).
- `app/assets` — browse/upload `design_assets` (tolerates the table not existing).
- `app/stops` — shared-stop library with import.
- `app/profile` — edit profile and upload an avatar. The delete-account button is disabled.

### API routes (`app/api/`)
Real: `acquire`, `checkout` (Stripe Checkout Session), `webhook/stripe`, `design/create`, `assets/upload`, `institutions[/id]`, `stops/import`, `admin/compute-quality-scores` (admin-only, manual), `analytics/[passportId]`, `notify/completion` (Resend email), `token/validate`, `token/redeem`. Partial or placeholder: `tip` (no real Connect transfer; no callers), `share/render` (returns SVG, not the intended PNG; random token).

## Backend

Database migrations live in three directories that do not form one coherent lineage. See `okuji-db/MIGRATIONS.md` and `okujiKobo/MIGRATIONS.md`.

- **`supabase/migrations/`** (mobile schema) — `001_initial_schema.sql`, `003_accolades_schema.sql`, `004_stamp_slots.sql`, `005_journal_photos.sql`. Uses the PostGIS extension: `stops.target_location` is `geography(Point,4326)`, with a GIST index and the `check_gps_within_radius()` RPC (`ST_DWithin`). Defines mobile-only tables: `proprietors`, `employee_accounts`, `collector_passports`, `redemption_tokens`, `accolades`, `reading_recommendations`, `teacher_notes`, `stamp_slots`, `journal_photos`. Uses `evidence_tier`. This set is not self-contained (`003` alters `institutions`, which it never creates).
- **`okujiKobo/supabase/migrations/`** (web schema) — `002` through `026`, the real incremental history. No PostGIS (plain `lat`/`lng` + `geohash` text). Uses `institutions`, `acquisitions`, `completion_tokens`, `verification_tier`. `institutions` is never created by a migration — `026_institutions_rls.sql` documents that it was created in the Supabase dashboard, and that RLS on it was off in production until migration 026.
- **`okuji-db/supabase/migrations/`** — `000_baseline.sql` (an 822-line clean-room consolidation of the web schema 002–011, plus an `institutions` definition), `002_blockpoint5.sql`, `003_blockpoint6.sql`, `004_collector_passport_last_used.sql`, and `archive/` (byte-identical copies of the web 002–011). `MIGRATIONS.md` says to run `000_baseline.sql` only for a fresh database. Note that `004` references mobile-only objects (`collector_passports`, `stamps.collector_passport_id`), so the baseline alone is not sufficient for it.

The two schemas model the same concepts with different names: institutions/proprietors, acquisitions/collector_passports, completion_tokens/redemption_tokens, employee_authorizations/employee_accounts, verification_tier/evidence_tier, plain lat-lng/PostGIS geography. They were intended to coexist in one Supabase project (the web `002_connect_schema.sql` layers on top of the mobile `001`), but the repo does not contain a single authoritative combined schema. Which schema the live database actually runs needs human confirmation.

### RLS
The web baseline enables RLS on all of its tables, with an admin bypass via `is_platform_admin()`. Several institution/employee write policies compare `institutions.id = auth.uid()`, which only matches if an institution row is keyed to a user's auth id. The mobile schema enables RLS on its tables with simpler owner-only policies and no admin bypass.

### Functions and triggers
`is_admin()` / `is_platform_admin()`, `handle_new_user()` (trigger `on_auth_user_created`), `trim_passport_autosaves()`, `touch_collector_passport_last_used()` (mobile-only target), `check_gps_within_radius()` (PostGIS, mobile), `update_updated_at()`.

### Edge functions (`supabase/functions/`)
Both require a valid Supabase JWT (validated via `supabase.auth.getUser(token)` in the shared `_shared/auth.ts` helper) and derive the caller's `userId` from the JWT; a body `userId`, if present, must match — 403 otherwise. After authentication, each function authorizes that the caller owns the stop's / page's passport via `collector_passports` (403 otherwise), then uses the service-role key for the actual reads/writes. Error responses are generic (`Authentication required` / `Not authorized`); detailed reasons are `console.error`'d server-side only.
- `verify-stamp` — reads the stop, applies tier logic (tier 5 honor/auto; tier 3 GPS-only via the PostGIS RPC; tiers 1–2 GPS + QR; tier 4 employee). Returns a precision-6 geohash and never the precise coordinate. It does not write the stamp; the client does (under RLS).
- `generate-token` — confirms every stop on a page is stamped (keyed to the JWT user), then inserts a `redemption_tokens` row with a `MCM-XXXX-XX` code and a 30-day expiry.

### Storage
Three buckets:
- `design-assets` (**public**; defined in the web schema) — uploads gated only by bucket id; only the delete policy enforces per-user folder ownership.
- `avatars` (**public**; web schema) — same pattern as `design-assets`.
- `journal-photos` (**private**; mobile schema, migration `005`) — 5 MB `file_size_limit` backstop. All three policies (insert / select / delete) require `(storage.foldername(name))[1] = auth.uid()::text`, so a user can only read or write under their own user-id folder. Path layout: `{user_id}/{journal_entry_id}/{photo_id}.{ext}`. Display uses short-lived signed URLs cached for one hour in `lib/journal-photos.ts`.

## Setup

### Prerequisites
- A Supabase project (see the migration caveat above before applying anything).
- For web payments: a Stripe account and a webhook endpoint pointing at `/api/webhook/stripe`.
- For Google sign-in: a Google OAuth client and the Supabase Google provider enabled, with `okuji://auth` (mobile) and `${origin}/auth/callback` (web) allow-listed. This is not configured in the repo.
- For completion emails: a Resend account with a verified sending domain for `okuji.app`.
- For mobile builds: an Expo/EAS account (the EAS project id is in `app.json`). For store submission: Apple and Google developer accounts.
- For web deployment: a Vercel project with the Root Directory set to `okujiKobo` (there is no `vercel.json` in the repo).

### Environment variables
Mobile (`.env` locally, or EAS environment variables for builds), all client-exposed:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required; the app throws without them)
- `EXPO_PUBLIC_SENTRY_DSN` (optional)

Web (`okujiKobo/.env.local`; see `okujiKobo/.env.local.example`):
- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BASE_URL`
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

Edge functions receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase runtime.

### Install and build
- Mobile (repo root): `npm install` (a root `.npmrc` sets `legacy-peer-deps=true`, required because the app is on React 19 while parts of the Expo/RN ecosystem still declare React 18 peers). Run with `npm run start` / `android` / `ios` / `web`. Type-check with `npm run type-check`. There is no test script.
- Web (`okujiKobo/`): `npm install`, then `npm run dev` or `npm run build`. There is no test script.

## Development

- Mobile builds use EAS (`eas.json`): development and preview profiles produce an internal Android APK; production produces an app bundle. App identity in `app.json`: package `com.okuji.app`, scheme `okuji`.
- Web deploys to Vercel with Root Directory `okujiKobo`. Vercel Analytics is enabled (`<Analytics />` in `okujiKobo/app/layout.tsx`).
- Edge functions deploy with `supabase functions deploy`.
- There are no automated tests in either app.

## Known limitations

Partially implemented:
- Mobile designer never sets stop GPS coordinates and never links `stamp_slots` to stops, so GPS verification cannot succeed for designer-authored stops.
- Stripe is test-mode and incompletely wired: `webhook/stripe` records `price_paid_cents: 0` and does not write `collector_passports`; the `tip` route never transfers funds (Stripe Connect onboarding is a TODO); the `CREATOR_SHARE`/`OKUJI_SHARE` revenue split in `lib/stripe/client.ts` is dead code (imported nowhere) and is never applied at checkout.
- Quality scores are computed only by a manual admin-triggered route (`api/admin/compute-quality-scores`); there is no scheduler.
- `api/token/validate` location/geofencing is a simplified placeholder that compares an institution id against a list of stop ids.
- `api/analytics/[passportId]` dwell-time is always null and return-visit rate is a proxy heuristic.

Stubbed, hardcoded, or mocked:
- Marketplace `passport/[id]` hardcodes institution and quality to null; `explore` hardcodes stop counts, quality scores, and certified status, so those UI elements never populate and related sorts are inert.
- `manage/analytics` and the designer "templates" option are "coming soon" placeholders.
- `api/share/render` returns SVG rather than the intended PNG and uses a random share token.
- `lib/stamp.ts` journal encryption is a no-op scaffold; `computeStampPlacement` and two employee components are unused. Voice transcription requires on-device support (`expo-speech-recognition`'s `requiresOnDeviceRecognition: true`); on devices/locales where the OS on-device model isn't available, voice entry is disabled (the user types instead) — there is no cloud fallback by design. Journal-photo backfill of legacy local URIs is on-demand only (Profile button), not automatic.
- Profile delete-account is disabled; a placeholder support contact ("nathan.app") appears in mobile `employee/help.tsx` and web `profile`.

Build and configuration:
- Web build sets `typescript.ignoreBuildErrors: true`, so type errors do not fail the build; combined with frequent `(supabase as any)` casts on untyped tables (`collector_passports`, `share_tokens`, `presence_sessions`, `design_assets`, `print_jobs`), schema drift is not caught at build time.
- Mobile calls `Sentry.init` with `enableNativeFramesTracking: true`, but the `@sentry/react-native` native config plugin has been removed from `app.json`, so native instrumentation is not wired.
- `okuji-db/`, `okujiKobo/supabase/`, and `supabase/` contain three overlapping migration sets; the canonical apply order is not determinable from the repo.

Security items to review:
- `api/employees/lookup` uses the service-role `getUserByEmail` but only checks that the caller is logged in, not that they manage the institution.
- `okujiKobo/.env.local.example` commits a real-format Supabase URL and an anon JWT rather than placeholders.
- Storage upload policies do not enforce per-user folders.
- Designer QR tokens and the share token use `Math.random`, not a cryptographic source.
