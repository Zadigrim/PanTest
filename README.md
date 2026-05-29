# Okuji

A monorepo containing two applications and a shared Supabase backend for creating, distributing, and collecting "passport" experiences: a React Native (Expo) mobile collector app and a Next.js web platform for creators and institutions.

> Naming note: the `okuji-db/` directory name is a historical artifact of the project's former "Panoply" brand; all SQL comments and code identifiers now use "Okuji." The redemption-token prefix is configurable per proprietor (`proprietors.token_prefix`; default `OKJ`, with existing McMenamins rows backfilled to `MCM`).

## What's in this repo

- **Mobile app (Okuji)** — React Native + Expo (SDK 54, RN 0.81.5, React 19.1, expo-router 6) at the repo root. The consumer app: browse/acquire passports, place GPS/QR-verified stamps, keep a journal, and two staff modes (employee redemption terminal, field acknowledgment).
- **okujiKobo (web)** — Next.js 14 (App Router, React 18) in `okujiKobo/`. The creator/institutional platform: a visual passport designer (referred to as OkujiDesigner, implemented inside this app — there is no separate `OkujiDesigner/` directory), a marketplace, institutional management, an employee terminal kiosk, Stripe checkout, and print-to-PDF.
- **Backend** — Supabase Postgres. Three Deno edge functions (`supabase/functions/`) and SQL migrations spread across three directories (see Backend). The mobile schema uses PostGIS; the web schema does not.

Tech stack summary: Supabase (`@supabase/supabase-js`; `@supabase/ssr` on web), NativeWind/Tailwind, expo-router (mobile) / App Router (web), Stripe (web), Resend (web), Sentry (mobile, with native crash + source-map upload), Vercel Analytics (web).

## Architecture

The two apps are independent codebases that talk to the same Supabase project. There is no shared code package between them; they each have their own Supabase client, their own dependency tree, and their own migration history.

Data flow for the core loop (verified in code):

1. A creator builds a passport in either the web designer (`okujiKobo/app/design/[id]`) or the mobile designer (`app/designer/`). Both write directly to `passports`, `passport_pages`, and `stops`.
2. A collector acquires a passport. On web, `okujiKobo/components/marketplace/AcquireButton.tsx` writes both `acquisitions` and `collector_passports`. On mobile, `acquirePassport` writes `collector_passports`.
3. A collector stamps a stop in the mobile app (`app/passport/[id].tsx` or `app/passport/stamp/[stopId].tsx`). The client takes a momentary GPS reading and calls the `verify-stamp` edge function, then inserts the result into `stamps`.
4. When all stops on a page are stamped, the client calls `generate-token`, which inserts a `redemption_tokens` row and returns a `{prefix}-XXXX-XX` code (prefix is per-proprietor; default `OKJ`, McMenamins backfilled to `MCM`).
5. Staff redeem that code in the mobile employee terminal (`app/employee/`) or the web terminal (`okujiKobo/app/(institutional)/terminal`).

A consequence of the two-schema split (see Backend) is that the edge functions are written against the mobile schema (`target_location`, `redemption_tokens`, the `check_gps_within_radius` RPC). The web designer writes plain `lat`/`lng` on stops; migration 008 adds a `BEFORE INSERT/UPDATE` trigger on `stops` that derives `target_location` from those scalars (`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`), so `verify-stamp` sees populated coordinates. The web Stripe purchase path still does not write `collector_passports`, so a passport bought via Stripe on the web does not currently appear in the mobile app through that path.

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
A working CRUD designer (lists/creates passports, edits sections, cover, theme, pricing, publish, and stop metadata — all real Supabase writes). The stop editor has Latitude/Longitude inputs and a "Use my current location" button (`expo-location` via `lib/gps.ts`); on save it writes `target_location` as WKT `POINT(lng lat)`. The pages screen drags each stop's box to `stops.box_x` / `stops.box_y` (migration 007), which the book renderer (`components/passport/DesignerCanvas.tsx`) reads to draw the tap target. QR tokens are server-issued via the `provision-qr-token` edge function (`crypto.getRandomValues`, stored as `stops.qr_code_id`); there is no client-side `Math.random` left in the QR path. The legacy `stamp_slots` table is no longer written by the designer (kept in the schema for backward compatibility). The designer's map still uses a hardcoded NYC initial region.

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
A Zustand-backed desktop-only visual editor. Working: page add/reorder (dnd-kit)/delete; stop add/select/delete with box drag/resize; text/image/line elements persisted as a JSON `elements` array on `passport_pages`; a full stop inspector (verification tier/radius, address + lat/lng, stamp picker, `is_shared` toggle); cover designer; 30-second autosave plus Cmd/Ctrl+S; canvas-rendered cover thumbnail; a publish wizard with validation; and PDF export. Stop QR tokens are server-issued via the `provision-qr-token` edge function (`crypto.getRandomValues(16)` → 22-char base64url, stored as `stops.qr_code_id`). The "use a template" option is disabled ("Templates coming soon").

`app/api/passports/[id]/print-pdf/route.tsx` produces a **duplex saddle-stitch booklet** via `@react-pdf/renderer`. Sheets are printed double-sided long-edge flip on US Letter, cut horizontally at the midline to produce two strips per sheet, stacked per the strip-label cues, folded along the vertical centerline, and stapled at the spine. Sheet 1's upper strip carries the assembly instructions; the lower strip carries the wide outside-cover image on side A and the wide inside-cover image on side B (the cover JSONB layers — back/front panel fills, optional full-bleed image, elements — are composited at print time). Stamp signatures pack two per sheet wherever possible (`⌈stamp_signatures / 2⌉` extra sheets), following the saddle-stitch imposition `outerRight=2k-1, outerLeft=P_padded-2k+2, innerLeft=P_padded-2k+1, innerRight=2k` with non-multiple-of-4 page counts producing trailing blanks. Page 1 is an auto-generated name/date/class page (Teacher field for `passport_type='learning'`, Group otherwise); a completion certificate is appended as the last reader page when `passports.print_certificate` is TRUE, or when it is NULL and `passport_type='learning'` or the owning institution's `institution_type` is in the K-12 educational set. The `copies` value is logged to `print_jobs` but does not multiply the output.

### Other surfaces
- `app/explore` — public catalogue. Stop counts, quality scores, and "certified" status are hardcoded to zero/null/false, so those columns never display and the quality/most-completed sorts are inert.
- `app/access` — institution and user administration (admin/manager scoped).
- `app/assets` — browse/upload/delete `design_assets`. Hard-delete (storage file + DB row) is gated by the `count_asset_references` RPC, which scans every reference location across drafts and published passports (`passport_pages.background_image_url`, `passport_pages.elements[].imageUrl`, `stops.stamp_asset_id`, `passports.cover_image_url`, and the `cover_outside_data` / `cover_inside_data` JSONB image fields and element arrays). Built-in assets are not deletable. Tolerates the table not existing.
- `app/stops` — shared-stop library with import.
- `app/profile` — edit profile and upload an avatar. The delete-account button is disabled.

### API routes (`app/api/`)
Real: `acquire`, `checkout` (Stripe Checkout Session), `webhook/stripe`, `design/create`, `assets/upload`, `assets/[id]` (DELETE; owner-gated, usage-checked hard delete), `institutions[/id]`, `stops/import`, `admin/compute-quality-scores` (admin-only, manual), `analytics/[passportId]`, `notify/completion` (Resend email), `token/validate`, `token/redeem`. Partial or placeholder: `tip` (no real Connect transfer; no callers), `share/render` (returns SVG, not the intended PNG; random token).

## Backend

Database migrations live in three directories that do not form one coherent lineage. See `okuji-db/MIGRATIONS.md` and `okujiKobo/MIGRATIONS.md`.

- **`supabase/migrations/`** (mobile schema) — `001_initial_schema.sql`, `003_accolades_schema.sql`, `004_stamp_slots.sql`, `005_journal_photos.sql`, `006_reissue_stop_qr_tokens.sql`, `007_stop_box_positions.sql`, `008_stop_lat_lng_bridge.sql`, `009_proprietor_token_prefix.sql` (adds `proprietors.token_prefix` with a `^[A-Z0-9]{1,6}$` format check; default `OKJ`, McMenamins rows backfilled to `MCM`), `010_collector_read_after_unpublish.sql` (broadens `pages_read` and `stops_read` to additionally allow SELECT when the caller has a `collector_passports` or `acquisitions` row, so unpublishing a passport does not break the book reader for existing collectors). Uses the PostGIS extension: `stops.target_location` is `geography(Point,4326)`, with a GIST index and the `check_gps_within_radius()` RPC (`ST_DWithin`). Migration 007 adds `box_x` / `box_y` / `box_width` / `box_height` on `stops` (the renderer's positioning columns); migration 008 adds `lat` / `lng` scalars plus a trigger that keeps `target_location` in sync, bridging the web designer's writes with what `verify-stamp` reads. Defines mobile-only tables: `proprietors`, `employee_accounts`, `collector_passports`, `redemption_tokens`, `accolades`, `reading_recommendations`, `teacher_notes`, `stamp_slots` (deprecated; positioning moved to `stops.box_*` in 007), `journal_photos`. Uses `evidence_tier`. This set is not self-contained (`003` alters `institutions`, which it never creates).
- **`okujiKobo/supabase/migrations/`** (web schema) — `002` through `030`, the real incremental history. Migration `027_asset_usage_check.sql` adds the `count_asset_references` RPC (SECURITY DEFINER) used by the assets hard-delete route. Migration `028_resize_cover_canvas.sql` rescaled every cover element's coordinates when the canvas grew from 560 × 392 → 1224 × 816. Migration `029_cover_canvas_correction.sql` then corrects the canvas to 1248 × 792 — each panel is now exactly the inside-page size (612 × 792) and the 24px slack lives in a real spine gutter between the panels; element y/height/font sizes are compressed by 792/816 and front-panel x values shift +24 to land east of the gutter. Migration `030_passports_print_certificate.sql` adds a tri-state `print_certificate` override (`NULL`=auto-detect, `TRUE`=always include, `FALSE`=always omit) for the printed booklet's completion-certificate page. No PostGIS (plain `lat`/`lng` + `geohash` text). Uses `institutions`, `acquisitions`, `completion_tokens`, `verification_tier`. `institutions` is never created by a migration — `026_institutions_rls.sql` documents that it was created in the Supabase dashboard, and that RLS on it was off in production until migration 026.
- **`okuji-db/supabase/migrations/`** — `000_baseline.sql` (an 822-line clean-room consolidation of the web schema 002–011, plus an `institutions` definition), `002_blockpoint5.sql`, `003_blockpoint6.sql`, `004_collector_passport_last_used.sql`, and `archive/` (byte-identical copies of the web 002–011). `MIGRATIONS.md` says to run `000_baseline.sql` only for a fresh database. Note that `004` references mobile-only objects (`collector_passports`, `stamps.collector_passport_id`), so the baseline alone is not sufficient for it.

The two schemas model the same concepts with different names: institutions/proprietors, acquisitions/collector_passports, completion_tokens/redemption_tokens, employee_authorizations/employee_accounts, verification_tier/evidence_tier, plain lat-lng/PostGIS geography. They were intended to coexist in one Supabase project (the web `002_connect_schema.sql` layers on top of the mobile `001`), but the repo does not contain a single authoritative combined schema. Which schema the live database actually runs needs human confirmation.

### RLS
The web baseline enables RLS on all of its tables, with an admin bypass via `is_platform_admin()`. Several institution/employee write policies compare `institutions.id = auth.uid()`, which only matches if an institution row is keyed to a user's auth id. The mobile schema enables RLS on its tables with simpler owner-only policies and no admin bypass.

### Functions and triggers
`is_admin()` / `is_platform_admin()`, `handle_new_user()` (trigger `on_auth_user_created`), `trim_passport_autosaves()`, `touch_collector_passport_last_used()` (mobile-only target), `check_gps_within_radius()` (PostGIS, mobile), `update_updated_at()`, `sync_stop_target_location()` (mobile, migration 008 — `BEFORE INSERT OR UPDATE` on `stops` that derives `target_location` from `lat`/`lng` and back-fills `lat`/`lng` from `target_location` on insert).

### Edge functions (`supabase/functions/`)
All three require a valid Supabase JWT (validated via `supabase.auth.getUser(token)` in the shared `_shared/auth.ts` helper) and derive the caller's `userId` from the JWT; a body `userId`, if present, must match — 403 otherwise. Each function then authorizes its specific action and uses the service-role key for the actual reads/writes. Error responses are generic (`Authentication required` / `Not authorized`); detailed reasons are `console.error`'d server-side only.
- `verify-stamp` — authorizes that the caller owns the stop's passport (via `collector_passports`), reads the stop, applies tier logic (tier 5 honor/auto; tier 3 GPS-only via the PostGIS RPC; tiers 1–2 GPS + QR; tier 4 employee). Returns a precision-6 geohash and never the precise coordinate. It does not write the stamp; the client does (under RLS).
- `generate-token` — authorizes ownership of the page's passport, confirms every stop on the page is stamped (keyed to the JWT user), then inserts a `redemption_tokens` row with a `{prefix}-XXXX-XX` code and a 30-day expiry. The prefix is looked up per-proprietor (`passport_pages → passports → proprietors.token_prefix`); falls back to `OKJ` when the proprietor row is missing or its prefix value fails the format check.
- `provision-qr-token` — authorizes that the caller is the passport's creator (`passports.creator_id`), then writes a `crypto.getRandomValues(16)` → 22-char base64url token into `stops.qr_code_id`. Default returns the existing token; an explicit `{ regenerate: true }` replaces it.

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
- `EXPO_PUBLIC_SENTRY_DSN` (optional; enables crash reporting in built apps)
- `SENTRY_AUTH_TOKEN` (EAS env secret, build-time only; used by the `@sentry/react-native/expo` config plugin to upload source maps during EAS builds)

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
- `okuji-db/`, `okujiKobo/supabase/`, and `supabase/` contain three overlapping migration sets; the canonical apply order is not determinable from the repo.

Security items to review:
- `api/employees/lookup` uses the service-role `getUserByEmail` but only checks that the caller is logged in, not that they manage the institution.
- Storage upload policies do not enforce per-user folders.
- `api/share/render` uses `Math.random` for its share token rather than a cryptographic source. (Stop QR tokens are no longer affected — they're server-issued via `provision-qr-token` using `crypto.getRandomValues`.)
