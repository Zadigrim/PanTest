# Standing rules for the Shuin / okuji / moichido repo

This file is the distilled ruleset. Anything not stated here that an
agent might reasonably want to do — ask before doing.

## Naming architecture

This repo houses the **Shuin** platform: the parent layer that owns
the marks, patents, and codebase (Delaware PBC planned). Shuin is
the company name. **It does not appear on collector-facing
surfaces.** Two consumer products run on Shuin's backend:

- **okuji** — the current passport / stamp-collecting product.
  Mobile app + creator/operator web (okujiKobo). The product brand
  collectors and creators see.
- **moichido** — future QR-only disposable punch-card loyalty
  product. Separate brand, own merchant portal, shared backend.
  **Deferred — do not build code for moichido in this repo until
  the moichido prompt explicitly starts.**

Where each name may and may not appear:

| Surface                          | Shuin     | okuji     | moichido  |
| -------------------------------- | --------- | --------- | --------- |
| Collector-facing UI / chrome     | NEVER     | YES       | (future)  |
| Marketplace listings             | NEVER     | YES       | (future)  |
| Repo internals / docs            | YES       | YES       | (future)  |
| Legal / licensing / patents      | YES       | NO        | NO        |
| Mobile bundle id / deep-link     | NEVER     | FROZEN    | NEVER     |
| README, CLAUDE.md, transition doc| YES       | YES       | YES       |

The mobile bundle identifier `com.okuji.app` and deep-link scheme
`okuji://` are FROZEN. A Google Play submission is pending; nothing
in this repo may touch them. See "Hard constraints" below.

## Governing invariants

These are the contracts every change in this repo must respect.
They are not preferences; they are the substrate.

1. **Acquisitions are preserved forever.**
   `public.acquisitions` rows are never deleted by application code
   except by the account-closure cascade in migration 049. Consumed
   / redeemed / expired credentials must be modeled as STATE on the
   row (e.g. `consumed_at`), never as DELETE. The historical record
   of who collected what survives any product-lifecycle change.

2. **`stamps UNIQUE(user_id, stop_id)`** (mobile schema, migration
   001). One stamp per collector per stop. Any future credential
   type that wants N punches at one location either gets N stops
   or a counter column on a new table — not a constraint relax.

3. **Single subscription mechanism.** Pro/Studio access is granted
   exclusively via `public.comp_subscriptions`; `profiles.{pro,
   studio}_*` columns are propagated by the migration-036 trigger
   and are read-only from app code. Do not branch the granting
   surface; the inline panel + standalone form both route through
   the same INSERT.

4. **Single admin check.** `is_platform_admin()` (SECURITY DEFINER
   RPC) is the only admin gate. RLS uses it, server routes use it,
   client gates derive from it via `detectRoles`. Do not invent
   a parallel role-check.

5. **Canonical stop model.** `stops.experience_type` +
   `experience_verification_method` are the canonical pair.
   `verification_tier` is DERIVED via the migration-046 sync
   trigger. App code reads the canonical pair (with
   `verification_tier` fallback for pre-046 rows handled in
   `lib/design/publish-checklist.ts`). Never write tier directly.

6. **Honest data only.** Every visible number on every operator
   surface (dashboard, /program tabs, audit page) traces to a real
   query. Dormant fields render at honest zero with a
   "tracking coming soon" / "Phase 2" treatment (see
   `lib/dashboard/flags.ts`). No illustrative numbers. No sample
   data in any deployed environment, ever.

7. **Aggregate-only insight surfaces.** "How many and when, never
   who." Per-collector identity never lands on creator/operator
   analytics. Counts, rates, timestamps — yes. Names, emails,
   per-collector journeys — no.

8. **`collector_passports` is the acquisition record for any
   credential type, persistent or consumable.** Persistent
   stamping reads/writes via `stamps.collector_passport_id`;
   consumable punching reads/writes via
   `card_instances.collector_passport_id` and
   `punches.card_instance_id`. The web-side `acquisitions` table
   records the purchase event and is upstream of either path.
   Do not invent a parallel acquisition table per credential
   type; the discriminator lives on `passports.credential_type`,
   the acquisition shape does not.

## Brand rules

- The okuji wordmark is **lowercase** in product chrome. The brand
  mark icon may be used standalone.
- **Color & radius tokens only.** Inline hex is a bug.
  - Web (kobo): `okujiKobo/tailwind.config.ts` — canonical scale
    (`ink`, `paper`, `cream`, `muted`, `hairline`, `accent`,
    `green`, `red`, `blue`, `navy`) + designer-only `surface-*`
    + cover-only `stock-*` + Program-hub additions `clay` /
    `field` + radii `card 6` / `panel 8` / `modal 12` /
    `program-card 14` / `program-control 9` / `program-pill 20`.
    The `stock-*` family is **cover-paper-only**, never UI.
  - Mobile: `constants/Colors.ts` — separate by convention,
    deliberately not extracted; see the transition doc.
- **Artboard dimensions follow the US/ISO passport spec**
  (ISO/IEC 7810 ID-3; see `okujiKobo/lib/print/passport-spec.ts`
  for the physical trim + bleed and `okujiKobo/lib/explore/svg/
  PageSvg.tsx` for the design-unit source): page 612×869 (88×125 mm
  portrait), covers 1252×869 full wraparound (back 612 · spine 28
  ≈4 mm · front 612 ≈180 mm), stamps 1:1, page images native ratio
  with object-contain. Changing the canonical proportions touches
  all three renderers (kobo canvas, mobile, print) plus a cover-
  element migration — don't do it casually.
- **No emoji in chrome.** Use Lucide / okuji icons. Emoji is fine
  inside collector-supplied data (stamp icons, journal entries).
- **No gradients.** Flat color, hairline borders, the subtle
  shadow at most.

## Build conventions

- **Investigate-then-build.** Substantial work pauses for a
  Phase 0 report (file/symbol references, decision points, scope
  guards) before code lands.
- **Scope guards are not suggestions.** When a prompt names
  out-of-scope surfaces, those files are not opened, not edited,
  not even imported as side effects.
- **Verification list in the PR description.** Per-tab, per-flow
  before/after; named queries for any visible number; honest-data
  sentences preserved verbatim.
- **Build-verified ≠ Nathan-verified.** A green `tsc --noEmit`
  and a successful push do not equal "shipped working." Nathan's
  in-app pass is the verification gate. Reports stay honest
  about that — never claim a build is "verified" without saying
  by which surface.
- **Deploy lag check.** When Nathan reports a runtime issue,
  consider whether the deploy has caught up before assuming
  a code-level bug. Check the most recent commit's relevance
  to the symptom.

## Hard constraints (narrowed — binary-affecting surfaces only)

Play approval has not been granted and there are zero users.
The freeze is therefore scoped to surfaces that affect the
mobile binary or could block a Play review. Server-side
additive migrations are OPEN — no user data exists to migrate
around.

Nothing in this repo may touch:

- `app.json:19` `"bundleIdentifier": "com.okuji.app"`
- `app.json:32` `"package": "com.okuji.app"`
- The `okuji://` deep-link scheme anywhere it appears in mobile
  routing (currently `app/(auth)/login.tsx`,
  `app/(auth)/register.tsx`, `app/_layout.tsx`)
- `eas.json` (if/when present), signing config, Play Console
  artifacts
- `app.json` build configuration of any kind
- Lockfiles (`package-lock.json`)
- Vercel deployment config (the platform tracks repo id, but
  verify the first post-rename deploy succeeds)
- Supabase project config or environment
- ANY change that requires a new mobile binary build — this
  includes mobile source under `app/`, `components/`, `hooks/`,
  `lib/` (root) when the change would alter shipped behavior;
  not the migrations directories.

What's OPEN (was previously frozen, now allowed):

- `okujiKobo/supabase/migrations/` — additive web-side
  migrations are fine. Don't rename, reorder, or retroactively
  edit historical comments. New `NNN_descriptive.sql` files
  only.
- `supabase/migrations/` — additive mobile-schema migrations are
  fine when they don't require a new mobile binary to consume
  (a CHECK constraint, a new column the existing client doesn't
  read, a new RLS policy). When a new column or function NEEDS
  client-side code to be useful, the schema migration is fine
  but the client-side consumption waits for a new build.
- `supabase/functions/` — Edge functions deploy independently;
  fine to modify.

If a vestige of an old project name lives inside one of the
frozen-list files, **report it; do not change it.** A PR that
"fixes" a frozen-list file is a P0 incident — it can block a
Play review or break a deploy.

## Repo rename heads-up

This repo will be renamed `PanTest → shuin` (Nathan performs
the GitHub rename). GitHub auto-redirects old URLs. See
`docs/shuin-transition.md` for the checklist Nathan runs at
rename time and the Phase 1 report that mapped what stays
and what may be touched.
