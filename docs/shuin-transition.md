# Shuin transition — living document

Status: **Phase 1 complete (this commit).** Repo rename, packages
extraction, and moichido work are all deferred until their trigger
conditions hit. This document carries the Phase 1 findings + the
checklists for when each later step fires.

## Context

The platform / parent layer is being named **Shuin** (Delaware PBC
planned; owns marks, patents, repo). Two products run on Shuin's
backend:

- **okuji** — current passport / stamp-collecting product.
- **moichido** — future QR-only disposable punch-card loyalty
  product. Separate brand, own merchant portal, shared backend.
  Deferred. Do not build moichido code in this repo until its
  prompt explicitly starts.

The repo will be renamed `PanTest → shuin` (Nathan performs the
GitHub rename; GitHub auto-redirects old URLs).

A Google Play submission is pending. The hard-constraint freeze
list in `CLAUDE.md` is non-negotiable while that's active.

## Phase 1 report

### Vestige inventory (PanTest / Pantest / Panoply)

Full-repo grep (case-insensitive), excluding `node_modules`,
`.next`, `.expo`, `.git`:

| File                    | Line | Match                                                                                     | Classification    |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------- | ----------------- |
| `README.md`             | 5    | "former 'Panoply' brand" — explanatory note about why `okuji-db/` is named that way       | SAFE-TO-RENAME    |
| `tailwind.config.js`    | 21   | "Legacy Panoply scale — retained during migration to canonical tokens."                   | SAFE-TO-RENAME    |

**Hard-constraint scan: clean.** No PanTest / Panoply vestiges
inside `app.json`, `eas.json`, mobile deep-link handlers,
migrations, or edge functions. There is nothing in a frozen file
that an enthusiastic agent could "fix" by accident.

### DO-NOT-TOUCH list (must remain unchanged)

A list of files / lines that may carry old terminology or
project-specific config, **and must not be edited during the
Play submission freeze**. Included verbatim so future PRs can
reference it.

- `app.json:19` `"bundleIdentifier": "com.okuji.app"`
- `app.json:32` `"package": "com.okuji.app"`
- Any `okuji://` reference in `app/(auth)/login.tsx`,
  `app/(auth)/register.tsx`, `app/_layout.tsx`
- `okuji-db/` directory name itself (historical sandbox; renaming
  would touch script paths and migration history)
- All files under `supabase/migrations/`
- All files under `okujiKobo/supabase/migrations/`
- All files under `supabase/functions/`
- `eas.json` and any related signing / build config
- `package-lock.json` at root and inside `okujiKobo/`
- Any Vercel / Supabase config files (none in-repo today; if
  added later, they join this list)

### Shared-code inventory — mobile (root) vs. web (okujiKobo)

Layout today:

```
/                            React Native mobile (name "okuji" v1.0.0)
  app/                       Expo Router routes
  components/                mobile UI
  lib/                       mobile utilities
  supabase/migrations/       mobile-first SQL (PostGIS-bearing)
  supabase/functions/        Edge functions (verify-stamp, etc.)
  okuji-db/                  Legacy DB sandbox (historical)
  okujiKobo/                 Nested Next.js web app
    app/                     Next.js App Router
    components/
    lib/
    supabase/migrations/     web-first SQL (no PostGIS)
```

| Concept                              | Mobile path                                | Web path                                                   | Extraction candidate?                                                  |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Date-token substitution              | `lib/stamp-date-token.ts` (thin mirror)    | `okujiKobo/lib/design/stamp-composer/date-token.ts` (canonical) | **YES — only true 1:1 mirror.** Mirror header already names canonical. |
| Supabase client                      | `lib/supabase.ts` (RN + AsyncStorage)      | `okujiKobo/lib/supabase/{client,server,types}.ts`          | NO — runtime contracts genuinely different.                            |
| Stamp helpers                        | `lib/stamp.ts` (render-side)               | `okujiKobo/lib/design/stamp-assets.ts` (asset management)  | NO — different responsibilities; name similarity only.                 |
| Color / token tables                 | `constants/Colors.ts`                      | `okujiKobo/tailwind.config.ts`                             | **NO — shared-by-convention** (deliberately separate per spec).        |
| Type defs for shared tables          | `types/index.ts`                           | `okujiKobo/lib/supabase/types.ts` (generated)              | partial — diverged shapes; defer.                                      |
| PostGIS RPCs (`find_passports_nearby`) | mobile `lib/nearby.ts`                   | not consumed by web                                        | NO — mobile-only.                                                      |
| publish-checklist logic              | not present                                | `okujiKobo/lib/design/publish-checklist.ts`                | NO — web-only today.                                                   |
| `verify-stamp` edge function         | called from mobile                         | not consumed by web                                        | Shared infra, not shared code.                                         |

**Net**: one genuine extraction candidate (date-token). Everything
else is platform-specific or shared-by-convention.

### moichido decision-point list (no code, just record)

A consumable credential type would force the following decisions.
Documented now so the moichido prompt can pick up where we left
off without rediscovering the constraints.

| # | Decision point                                                         | Touches                                                       | Conflict / decision                                                                                                                  |
| - | ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | `stamps UNIQUE(user_id, stop_id)`                                      | `stamps` constraint (migration 001)                           | Compatible IF each punch is its own stop. If N punches share one stop, needs a counter column or a new table — not a constraint relax. |
| 2 | Acquisitions preserved forever                                         | `acquisitions` (only deleted by account-closure cascade in 049) | A consumed punch-card must be STATE on the row (`consumed_at`), never DELETE.                                                       |
| 3 | `acquisitions UNIQUE(user_id, passport_id)`                            | constraint                                                    | Blocks a holder from starting a new card after consuming one. Decision: separate `passport_instance` row OR relax constraint OR model punch-card distinctly. |
| 4 | Stop verification methods                                              | `stops.experience_verification_method`                        | moichido is QR-only — already supported. No conflict.                                                                                |
| 5 | `verification_tier` derived via 046 sync trigger                       | trigger                                                       | QR maps to a tier already. No conflict.                                                                                              |
| 6 | Publish + republish snapshots (migrations 063 / 064 / 067)             | `passport_published_snapshots`, `passport_republish_log`      | Punch-card may want lighter republish discipline. Compatible; may want a flag.                                                       |
| 7 | `verify-stamp` ownership check via `collector_passports` (= acquisitions) | `supabase/functions/verify-stamp/index.ts`                  | moichido routes through the same function. No conflict.                                                                              |
| 8 | One `completion_tokens` per (user, page)                               | `completion_tokens`                                           | Punch-card without a completion ceremony can bypass tokens. Opt out at config time.                                                  |
| 9 | Marketplace listing (`is_free` / `price_cents`)                        | `passports`                                                   | Merchant-issued cards may be distribution-only. Add `is_listable` or distribution model.                                             |
| 10 | Brand chrome                                                           | UI components                                                 | Not a schema decision; a UI multiplexing problem (sibling frontend or runtime brand prop).                                           |

**Summary**: most invariants survive moichido unchanged. The only
real schema-level decisions are (3) — `acquisitions` uniqueness —
and (1) — `stamps` uniqueness, conditionally. Everything else is
configuration or UI multiplexing.

### Monorepo structure recommendation

**WAIT.** Setting up Yarn/PNPM/Turborepo workspaces and extracting
`packages/shuin-*` for ONE shared file (the date-token mirror) is
over-engineering. The risk of perturbing metro / Vercel / Expo
bundlers during a pending Play submission outweighs the benefit.

**Trigger condition to extract:**

> Extract a `packages/shuin-*` workspace when moichido's first
> build begins AND at that moment ≥3 modules genuinely need to be
> shared (e.g. date-token + a stamp render contract + a moichido
> QR helper).

Until then: the mobile-mirror file pattern (one file, header
pointing at the canonical) is the lowest-cost discipline.

## Checklist — repo rename day (PanTest → shuin)

Nathan performs the rename. The following steps happen in order;
each one is independently verifiable, and the rename is reversible
up through step 3.

1. **GitHub Settings → Rename repository** to `shuin`. GitHub
   auto-creates a redirect from `github.com/Zadigrim/PanTest` →
   `github.com/Zadigrim/shuin`. The old URL keeps working for
   git operations and web links; the redirect is durable.

2. **Update local remotes** on every machine + sandbox the team
   uses:

   ```bash
   git remote -v        # confirm the old URL
   git remote set-url origin git@github.com:Zadigrim/shuin.git
   # ...or the HTTPS variant if that's what's configured
   git remote -v        # confirm the new URL
   git fetch            # smoke test
   ```

   GitHub's redirect makes this optional in practice (git follows
   the redirect), but explicit is better. Update the URL in any
   shell aliases / scripts pointing at the repo.

3. **Hardcoded repo URLs.** Phase 1 confirmed none inside in-scope
   files (the only `github.com/...` strings live in
   `node_modules/` and `.git/` which the rename handles
   automatically). If new ones land between now and rename day,
   they should be added to this checklist.

4. **Vercel.** Verify the first post-rename deploy succeeds.
   Vercel tracks the repository by internal id, not by name, so
   the rename should be transparent — but the FIRST deploy after
   the rename is the proof. Check that:
   - the build triggers from the new repo URL,
   - the deploy URL on `vercel.app` stays the same,
   - environment variables are intact.

5. **Supabase MCP scope** (the tool restriction in this Claude
   Code session). The current session is locked to
   `zadigrim/pantest`; after the rename, future sessions need
   `zadigrim/shuin` in their MCP repository allowlist. Nothing
   for Nathan to do today — record the bookkeeping note here.

6. **The two transition documents** (`CLAUDE.md`,
   `docs/shuin-transition.md`) carry forward verbatim. They
   reference "PanTest" in zero places — both were written to
   survive the rename.

7. **README.md** continues to call the product *Okuji* and the
   monorepo a *monorepo*. The wording will need a light update
   to add "(repo: `Zadigrim/shuin`)" or similar at rename time;
   this Phase 2 commit leaves it alone since the rename hasn't
   happened yet.

## Known Issues — open items tracked here

Items in this list are deferred work that the repo should NOT
silently accept as "done." A KI entry stays open until either
fixed or explicitly accepted as known.

## M2 — Consumable credential schema (shipped)

The data-model milestone for the moichido (consumable punch-card)
credential type. Schema + RLS + leak guard + one doc note only —
no verify-stamp changes, no token issue/consume logic, no UI,
no mobile code (M3 / M4 territory).

### Rulings binding on later milestones

- **credential_type discriminator** on `passports`: `'persistent'`
  (today's model) | `'consumable'` (moichido).
- **Per-punch rows in a DEDICATED `punches` table** — stamps stays
  byte-identical. The earlier approach (migration 014 adding
  `stamps.card_instance_id` + partial-unique-index replacement)
  was abandoned and reverted by migration 017; the dedicated
  table is cleaner. Each punch carries its own date and
  (optionally) its own visual position.
- **One active card instance per user × passport**, sequential
  reissue. After consume, a new instance can be issued referencing
  the same `collector_passports` row.
- **`consumed_at` state, never DELETE** — consumables stay inside
  the preservation invariant (CLAUDE.md governing invariant #1).
- **`collector_passports` is the universal acquisition record** —
  per CLAUDE.md governing invariant #8. Persistent stamping and
  consumable punching both hang off it.
- **Vendor-presented one-off single-use QR per punch** — the
  `stop_qr_tokens` table holds these. Structure only at M2; the
  issue + redeem functions are M3.

### Tables, columns, and the constraint NON-replacement

| Object | Tree | Migration | Notes |
| --- | --- | --- | --- |
| `passports.credential_type` text NOT NULL DEFAULT `'persistent'` CHECK IN (`persistent`, `consumable`) | web | `okujiKobo/.../069_consumable_credential_passport.sql` | additive; existing rows default to `persistent` |
| `passports.distribution_only` bool NOT NULL DEFAULT `false` | web | same 069 | additive; the leak-guard column |
| `card_instances` table (id, collector_passport_id FK, sequence, issued_at, consumed_at) | mobile | `supabase/.../014_consumable_credentials.sql` | one-active-per-acquisition enforced by partial unique index. **Note**: migration 014 ALSO modified stamps; those modifications were reverted by migration 017 — the card_instances portion stays. |
| stamps modifications from 014 (card_instance_id + partial unique indexes) | mobile | reverted by `supabase/.../017_stamps_revert_card_instance.sql` | stamps now byte-identical to its pre-1a8a078 shape |
| `punches` table | mobile | `supabase/.../018_consumable_punches.sql` | dedicated table; stamps untouched |
| `stop_qr_tokens` table | mobile | `supabase/.../015_stop_qr_tokens.sql` | admin-only RLS; M3 functions handle writes via service role |
| `find_passports_nearby` RPC | mobile | `supabase/.../016_find_passports_nearby_distribution_guard.sql` | `CREATE OR REPLACE` adds `AND p.distribution_only = false` |

**The compensating migration (017) is a Path B artifact** — 014
had already been applied to production before the re-spec landed,
so the stamps modifications needed to be ROLLED FORWARD via a new
migration rather than edited out of 014's file. The card_instances
portion of 014 stays in place; only the stamps-side ALTERs got
undone.

### `punches` — slim column set

Per Nathan's M2 re-spec ruling (Clean Loop brand direction:
closing-loop, not finger-press ink):

```
id                  uuid PK
card_instance_id    uuid NOT NULL FK card_instances
punch_sequence      int  NOT NULL
user_id             uuid NOT NULL FK profiles (denormalized for RLS)
stop_id             uuid NOT NULL FK stops
punched_at          timestamptz NOT NULL DEFAULT now()
geohash             text NULL
verification_method text NULL
stamp_pos_x         float NULL  -- with 0..100 CHECK (migration 013 pattern)
stamp_pos_y         float NULL  -- with 0..100 CHECK
UNIQUE(card_instance_id, punch_sequence)
```

**Excluded** (moichido's punch is a "closing loop," not a
finger-press ink mark):

- `saturation`, `smudge_dx`, `smudge_dy`, `smudge_intensity` —
  okuji-specific gesture-derived appearance (migration 040)
- `contact_size_px`, `rotation_deg` — okuji-specific press-derived
  appearance

**Appearance parity with stamps deferred unless the punch render
needs it.** Adding the excluded columns back is a one-line follow-up
migration if M4 surfaces a need.

### `user_id` denormalization on `punches`

Denormalized from `card_instances → collector_passports.user_id`
for a clean RLS predicate (`user_id = auth.uid()` instead of an
EXISTS chain through three tables). **No equality trigger.** M3
SECURITY DEFINER write functions are trusted to set `user_id`
consistent with the card_instance's collector_passport's user_id;
the trust comes from those writes being concentrated in a single
PL/pgSQL surface.

### Deploy order

(1) Web 069 → (2) Mobile 014 → (3) Mobile 015 → (4) Mobile 016 →
(5) Mobile 017 (compensating, reverts 014's stamps modifications) →
(6) Mobile 018 (punches table).

Steps 1–4 already applied (Path B). Steps 5 and 6 ship in this PR.

### Application surfaces gated on `distribution_only`

| File | Surface | Behavior |
| --- | --- | --- |
| `okujiKobo/app/explore/page.tsx` | public Explore browse | filter `.eq('distribution_only', false)` |
| `okujiKobo/app/explore/[id]/page.tsx` | Explore detail + metadata | filter `.eq('distribution_only', false)` |
| `okujiKobo/app/(marketplace)/creator/[id]/page.tsx` | per-creator marketplace listing | filter `.eq('distribution_only', false)` |
| `okujiKobo/app/(marketplace)/passport/[id]/page.tsx` | marketplace detail (page + metadata) | branched: 404 for non-holder non-creator non-admin when distribution_only=true; holders still see their copy (mirrors migration 062 holder-acquired-read pattern) |
| `supabase/migrations/012` → `016` | `find_passports_nearby` RPC | `AND p.distribution_only = false` in the WHERE |

All five guards landed in 1a8a078 — no application code changes
this PR.

### KI-08 — Server-side center-within-box rule is unenforced

(Renumbered from a duplicate KI-04 label. The canonical register
is `docs/known-issues.md`; this entry remains here as the
historical investigation context, but the live status lives in
the register.)

**Surface:** stamp placement.

**Today:** the mobile stamp-placement helper at `lib/stamp.ts:38-45`
(`computeStampPlacement`) enforces the rule client-side only. The
server-side `supabase/functions/verify-stamp/index.ts:55-177`
verifies GPS/QR/tier but NEVER receives box coordinates or
stamp_pos_x/y; it has no way to enforce that the stamp's center
falls inside the location element's region.

**Risk:** a modified client could insert a stamp row with
`stamp_pos_x` / `stamp_pos_y` outside the box. Migration 013
(this commit) catches the simpler half — out-of-domain values
(stamp_pos_x or stamp_pos_y outside 0..100) are rejected at the
database. It does NOT verify the position is inside the
SPECIFIC location element on the page; that's the deferred half.

**Hardening (deferred — completes KI-08):** add `stops.box_x /
box_y / box_width / box_height` to the verify-stamp payload and
enforce the rule in the edge function before returning
`verified: true`. Or move the stamps INSERT into verify-stamp
itself and reject out-of-box positions there. Either touches
`supabase/functions/` (in scope for non-Play-blocking work) but
the call-site code paths are in the mobile app — requires a new
mobile binary build.

**Source:** patent-investigation report, divergence #3
("Center-within is client-only").

## What this commit changed

Mechanical only:

- **New**: `CLAUDE.md` (repo root) — standing rules.
- **New**: `docs/shuin-transition.md` — this file.
- **Edited**: `README.md:5` — "former 'Panoply' brand" → updated
  wording, same intent.
- **Edited**: `tailwind.config.js:21` — "Legacy Panoply scale"
  comment → updated wording, same tokens.

Zero logic. Zero config. Zero schema. Both apps build identically
before and after.
