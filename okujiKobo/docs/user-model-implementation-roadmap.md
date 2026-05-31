# Okuji user-model implementation roadmap

**Status:** draft, branch `claude/fervent-gates-1xa4b`, 2026-05-30.

**Inputs:** Appendix L of *Okuji Operations &amp; Business Plan* (target state, structure locked, prices pending), and `okujiKobo/docs/user-access-model.md` (current-state synthesis as of HEAD).

**Purpose:** map the gap between what the code does today and what Appendix L specifies, broken into discrete work items with effort, dependencies, and sequencing. The output of this document is the input to future implementation prompts — each PR will pick one or more work items and execute.

**This document is not code.** No migrations, no schema, no RLS — only a plan.

## Progress log

| Date | Branch / commit | Items closed |
|---|---|---|
| 2026-05-30 | `feat/phase-0-security-cluster` (`a38093b`, `c6a0c5e`, `0c2fab4`, `f30d43f`) | SEC-01, SEC-04, SEC-05 (code; migration apply pending), FIX-05 |
| 2026-05-30 | `feat/phase-0-closeout` (`07108d8`) | SEC-06 |
| 2026-05-30 | DEC resolution session (docs-only) | DEC-02, DEC-08, DEC-16, DEC-17, DEC-18, DEC-19 resolved. New work item BLD-31 added. Downstream notes added to SEC-03, FIX-02, FIX-06, FIX-07, CLN-01, CLN-06, CLN-07, CLN-08, BLD-05, BLD-29. |
| 2026-05-30 | `feat/fix-01-mobile-terminal-unification` (`898725c`, `c171025`, screens, `09ece7d`, roadmap) | FIX-01. Three legacy tables retired in migration 032 (`redemption_tokens`, `employee_accounts`, `proprietors`) — work that was scheduled for Phase 6 cleanup, pulled forward because they were FK-coupled to the FIX-01 migration. Discovery-surfaced parallel-tables item (proposed as FIX-08) absorbed into this PR. Mobile dead-code cleanup: `components/employee/PrizeDistribution.tsx` and `TokenScanner.tsx` deleted; legacy types (`RedemptionToken`, `EmployeeAccount`, `Proprietor`, `ProprietorTier`) removed. |
| 2026-05-30 | `feat/phase-1-foundational-schema` (migrations + can_add_extras retirement + comp admin UI + roadmap) | **Phase 1 closed in code.** BLD-01..05, BLD-07, BLD-08, BLD-12, FIX-06, SEC-03, DEC-18 audit + RLS expansion, DEC-19 README. Six migrations 033-038. Comp admin UI at `/access/comp-subscriptions`. `can_add_extras` retired across 7 application files. Three discovery-time decisions: DEC-18 RLS expansion extended to `print_jobs` + `design_assets` (institutional artifacts survive turnover); `last_edited_by` uses a trigger (1 file) instead of app-layer writes at 19 sites; comp ↔ profile sync uses a trigger. |
| 2026-05-30 | `feat/bld-32-33-demo-mode-voice-camera` (mobile + migration 039 + roadmap) | **BLD-32** (per-passport demo mode: migration `039_passports_is_demo.sql`, banner + bypass + admin toggle in `app/passport/[id].tsx`); **BLD-33** (30 s voice recording cap with `continuous: true` switch); live camera capture path in `components/journal/JournalEntry.tsx` via `ImagePicker.launchCameraAsync`; unified post-stamp capture surface (`components/passport/PostStampCaptureSheet.tsx`) replacing the previous Alert in Flow A. Standalone `/journal/[stampId]` modal route untouched. Flow B (QR/deep-link stamp route) untouched. |
| 2026-05-30 | `feat/expressive-stamp-gesture` (mobile + migration 040 + roadmap) | **BLD-34** (expressive stamp gesture, proxy version): migration `040_stamp_appearance.sql` adds `stamps.saturation` + `stamps.smudge_dx / smudge_dy / smudge_intensity`. New `components/stamp/StampGestureInteraction.tsx` reads duration / initial-vector / path on the LocationBox itself. `StampArtwork` renders gesture-derived saturation (as opacity) and a directional motion-blur trail. `components/passport/StampingOverlay.tsx` (the pre-stamp confirmation modal) deleted — gesture + live preview now live in the LocationBox directly. Pre-040 stamps render exactly as before via fallback path. Flow B untouched. |
| 2026-05-30 | `feat/institution-access-completion` (okujiKobo + migration 041 + roadmap) | **Institution access provisioning UI gap closed.** Migration `041_business_inputs.sql` adds nullable `institutions.annual_revenue` + `marketing_spend` (Business-tier inputs; captured-only, no computation). UI additions on `/access/institutions/[id]` and the AddInstitutionDialog: tier dropdown (civic/municipal/business/pending, set manually), token_prefix editable text input (uppercase-normalized, 1-6 [A-Z0-9]), annual_revenue + marketing_spend numeric inputs conditionally surfaced when `tier === 'business'`. Member roster (both `/access/institutions/[id]` and `/manage/employees`) gains 4 new checkboxes for `can_design`, `can_manage_employees`, `can_view_analytics`, `can_manage_billing` — labeled and committed as **provisioning-convenience only**; no enforcement / RLS / gating changes (Phase 2 / SEC-02 wires those). `InstitutionTier` type drift fixed (was legacy `community|commercial|enterprise`, now matches migration 034's CHECK). `pricing_model` computation unchanged; tier and pricing_model remain independent. |
| 2026-05-30 | `feat/wire-bld-34-gesture` (mobile only) | **BLD-34 wiring fix.** A read-only investigation surfaced that BLD-34's `StampGestureInteraction` was shipped but ORPHANED — the new gesture was hosted by `components/passport/LocationBox.tsx`, only imported by `GeographicSection.tsx`, which had zero importers. The active collector path went through `DesignerLocationBox → StampPressInteraction` (the legacy pre-BLD-34 gesture). Result: stamps placed in production wrote NULL into the migration-040 columns and rendered via the legacy fallback. This PR swaps `StampPressInteraction → StampGestureInteraction` inside `DesignerLocationBox` (Option A from the build prompt — identical prop signatures made it a one-component swap). Cleanup deletes the now-fully-orphaned trio: `components/stamp/StampPressInteraction.tsx`, `components/passport/LocationBox.tsx`, `components/passport/GeographicSection.tsx`. No new migrations. No web changes. |
| 2026-05-30 | `feat/mobile-page-fidelity` (mobile only) | **Mobile passport-page fidelity pass.** Reduces the cross-platform drift surfaced by the prior comparison investigation. Three layers: (1) page background opacity / paper color / grain aligned with okujiKobo's `PageBackground.tsx` so a page looks the same on both surfaces (was: opacity defaulted ~11% on mobile vs 100% on web; paper color fall-through chain differed; grain was flat 2.5% vs SVG noise 4%). DesignerLocationBox now renders the stop's name + year label inside the box (was: blank; the deleted orphan LocationBox.tsx had this rendering, now lives in the active path). (2) `StampArtwork` adds a custom-asset render mode: when `stop.stamp_type='custom_asset'` and `stop.stamp_asset.url` is populated, the designer's uploaded artwork renders as an `<Image>` modulated by gesture-derived size/rotation/saturation/smudge — instead of the generic shape+emoji proxy that mobile was showing regardless of the designer's choice. `usePassport` now joins `design_assets!stamp_asset_id` to surface the URL. Mobile `Stop` type gains `stamp_asset_id` + `stamp_type` (existed in DB since migration 012, absent from the mobile type). (3) `CoverPanel` component renders ONE half of a designer-built cover spread (1248×792 → 612×792 page). `BookCover` shows the front panel of `cover_outside_data`; `InsideCoverPage` shows the back panel of `cover_inside_data` (the inside-front face). Both fall back to the existing procedural covers when the designed data is null. Mobile `Passport` type + `CoverSideData` type added. Element renderers (text / image / lines) extracted to `components/passport/PageElementRenderer.tsx` so cover-spread and stamp-page render via the same primitive. No new migrations. No web changes. |

**SEC-05 migration apply status:** `okujiKobo/supabase/migrations/031_design_assets_storage_policy.sql` is committed but NOT yet applied to production. The storage policy is not enforced until the migration runs. Apply with `supabase db push` (or `supabase migration up` per the project's local convention) and verify with `select policyname, cmd, with_check from pg_policies where tablename = 'objects' and policyname = 'design_assets_upload';` — the `with_check` body should include `(storage.foldername(name))[1] = auth.uid()::text`.

Phase 0 status after the 2026-05-30 PRs: **fully closed in code.** Items reclassified out of Phase 0 (not closed, just moved to a more honest phase): SEC-02 → Phase 2. SEC-03 and FIX-06 closed in the Phase 1 PR. FIX-07 → Phase 6. Operational tail (Phase 0 + Phase 1): apply migrations `031`, `032`, and `033`-`038` in order; redeploy the `generate-token` edge function. Phase 1 also closed in code as of the same date.

Two minor pre-statements to clear up before the inventory:

- **Appendix L is silent on `can_add_extras`.** The current code has this flag (`employee_authorizations.can_add_extras`); Appendix L lists `can_design / can_verify / can_distribute_prizes / can_manage_employees / can_view_analytics / can_manage_billing` and does not mention `can_add_extras`. I treat this as a DEC (keep, fold into `can_distribute_prizes`, or retire), not a silent omission.
- **Appendix L locks the institutional-manager pattern as `is_platform_admin()` + per-flag capabilities**, NOT as the `institutions.id = auth.uid()` pattern that exists in the code today. That pattern is therefore dead-code-by-design and replaced by `can_manage_employees`. I treat this as DEC + CLN, not a redesign question.

---

## Section 1 — Executive summary

**The gap is large but cleanly partitionable.** 43 distinct work items (BLD-32, BLD-33, BLD-34 added 2026-05-30 alongside their PRs). Status as of 2026-05-30: Phase 0 and Phase 1 both closed in code; institution-access provisioning UI gap closed in `feat/institution-access-completion`. Security fixes (6, of which **5 closed** — SEC-01, SEC-03, SEC-04, SEC-05, SEC-06). Broken-today implementation fixes (7, of which **3 closed** — FIX-01, FIX-05, FIX-06). New infrastructure (28; BLD-05 now fully closed via the access-completion PR; BLD-01..04 + BLD-07, BLD-08 are SCHEMA + PROVISIONING UI done with enforcement still Phase 2; BLD-12, BLD-32, BLD-33, BLD-34 fully closed; plus the canonical-tree README). Dead-code cleanup (9 — plus two table retirements pulled forward into FIX-01 and one modal deletion pulled forward into BLD-34). Product decisions (20 total — **6 resolved 2026-05-30**, 14 still open).

**Recommended broad sequencing:**

1. **Phase 0 — Pre-beta security and correctness — DONE.** Originally 5 SEC + 2 FIX items. Closed: SEC-01, SEC-04, SEC-05, SEC-06, FIX-01, FIX-05. Items reclassified out of Phase 0 (not closed, just moved): SEC-02 → Phase 2, SEC-03 → Phase 1 (closes when the `can_add_extras` retirement migration runs and `okujiKobo/app/api/token/redeem/route.ts:128-135` is updated), FIX-06 → Phase 1, FIX-07 → Phase 6. **Operational follow-up: apply migrations 031 and 032 to production.**
2. **Phase 1 — Foundational schema and capability infrastructure — DONE.** Six migrations (`033`–`038`) shipped on `feat/phase-1-foundational-schema` (2026-05-30). The four new capability flag columns exist on `employee_authorizations` (BLD-01..04); `institutions.tier` exists with CHECK + manual-classification semantics (BLD-05, DEC-02); Pro/Studio subscription state on `profiles` (BLD-07, BLD-08); `comp_subscriptions` table with the `sync_comp_to_profile` trigger that keeps `profiles.{pro,studio}_status` derived (BLD-12); `last_edited_by` / `last_edited_at` on `passports` plus a `BEFORE UPDATE` trigger that sets them automatically (DEC-18 audit); RLS on `passports`, `passport_pages`, `stops`, `passport_autosaves`, `print_jobs`, `design_assets` expanded to allow can_design employees at the owning institution (DEC-18). `can_add_extras` retired across schema + 7 application files (DEC-08 fold, SEC-03 closure). FIX-06 default change to `(false, false)` shipped in the same migration. Comp admin UI lives at `/access/comp-subscriptions`. Canonical-tree README added per DEC-19. **A small successor task — BLD-31 (1-2 days) — lands between Phase 1 and Phase 2.**
3. **Phase 2 — Institutional capability enforcement.** Wire the new flags into RLS and API routes. Replace the `institutions.id = auth.uid()` manager pattern with `can_manage_employees`. Fix the multi-institution switching UX. **Total ~2-3 weeks.** Required for McMenamins beta.
4. **Phase 3 — Designer access gating.** Trial-passport limits for Free; private/invite-only mechanism for Pro; public-marketplace gate for Studio + Institution. Implementable as soon as Phase 1 is done. **Total ~2-3 weeks.** Required for ambassador program.
5. **Phase 4 — Subscription billing.** Pro, Studio, Municipal, Business billing via Stripe. **Total 4-8 weeks. Blocked by deferred Stripe work — do not start until that block lifts.**
6. **Phase 5 — Quality and analytics.** Creator analytics, 1-5 star ratings, reactive quality monitoring, optional pre-publish review. **Total 4-6 weeks.** Can land in pieces — analytics first, monitoring later.
7. **Phase 6 — Schema cleanup and consolidation.** Retire unreachable role values, drop the redundant `is_admin()` wrapper, dead policies, and resolve the three-migration-tree confusion. **Total 1-2 weeks once decisions are made.** Pure hygiene; no behavioral change. Defer until post-beta.

**Total effort range:** ~15-25 working weeks of focused engineering, *excluding* Phase 4's Stripe work and *excluding* the Pro consumer features (family, groups, timeline, search, tags, Heritage Edition discount) which are out-of-scope for v1 institutional beta. With Pro consumer features included and Stripe work in scope, this becomes a multi-quarter program.

**Hard blockers for others:**
- Phase 1 (BLD-01 through BLD-05, BLD-12) blocks Phases 2-5.
- Phase 4 (subscription billing) is itself blocked by the deferred Stripe revisit. Studio/Pro tiers can be designed and built behind a feature flag without billing, but cannot actually charge users.
- Phase 2's `can_view_analytics` enforcement blocks Phase 5's analytics dashboards becoming production-safe.

**Items deferrable past beta without harm:**
- All Pro consumer features (family, groups, timeline, search, tags, Heritage Edition).
- Quality monitoring automation (manual ad-hoc review by Nathan suffices for the first 10-20 Studio ambassadors).
- Schema-tree consolidation (cosmetic; no functional impact).
- Finer-grained admin roles (per Appendix L.7, not until there's even one part-time team member).

**Items with hard dependencies on the deferred Stripe work:**
- BLD-07, BLD-08, BLD-25, BLD-26, BLD-27 — the entire billing infrastructure. Pro / Studio / Municipal / Business cannot collect revenue until this lifts.
- The ambassador comp program (BLD-12) is a partial workaround: comped subscriptions don't require Stripe, so ambassadors can be onboarded to a "Studio" tier with no billing wired up. This means Studio's *functional* features (BLD-09 through BLD-14) can ship and be exercised by real users before billing exists.

**Critical-path call:** for an invited beta with McMenamins and 10-20 ambassadors, the minimum is **Phases 0 + 1 + 2 + a trimmed Phase 3 + the comp-subscription parts of Phase 4**. Everything else can come later. See §5.

---

## Section 2 — Work items inventory

Items are numbered with a type prefix (SEC / BLD / FIX / CLN / DEC) and a sequence number. Effort is honest — multi-day items mean what they say.

### SEC (Security and authorization gaps that exist today)

#### SEC-01 — Restrict `api/employees/lookup` to scoped callers — **DONE**
- **Status:** closed in commit `a38093b` on `feat/phase-0-security-cluster` (2026-05-30).
- **Appendix L:** L.5 implies institutional managers add employees; L.6 lists `can_manage_employees`.
- **Was:** `okujiKobo/app/api/employees/lookup/route.ts:14-30` required only `getUser()`. Public email-enumeration oracle.
- **Resolution:** added a gate requiring the caller to be a platform admin OR hold at least one `employee_authorizations` row. Closes the public oracle while keeping `/manage/employees` and `/access/institutions/[id]` add-staff flows working for non-admin institutional managers.
- **Phase 2 follow-up:** tighten further to require `can_manage_employees` at the *target* institution once BLD-02 lands.

#### SEC-02 — Tighten `api/institutions/[id]` PATCH
- **Appendix L:** L.6 — institution metadata edits should require `can_manage_billing` or `can_manage_employees` depending on field; "any employee" is too permissive.
- **Today:** `okujiKobo/app/api/institutions/[id]/route.ts:18-25` accepts ANY `employee_authorizations` row at the institution. Selects `can_add_extras` but never tests it.
- **Type:** SEC.
- **Effort:** 1-2 days. Decide which fields require which flag (rename + slug = `can_manage_employees`; tier + payment = `can_manage_billing`); enforce both.
- **Dependencies:** BLD-02 + BLD-04 (the flags must exist first); can ship as Phase 0 fix gated on `is_platform_admin()` only until those land.
- **Risk if deferred:** a verifying employee can rename or reconfigure their institution.

#### SEC-03 — Enforce `can_add_extras` at the RLS layer — **DONE**
- **Status:** closed in the Phase 1 PR `feat/phase-1-foundational-schema` (2026-05-30) alongside migration 033's `can_add_extras` column drop.
- **Resolution:** the dead `can_add_extras` API check at `okujiKobo/app/api/token/redeem/route.ts` was removed. The existing `tokens_employee_update` RLS policy (gates on `can_distribute_prizes`) covers the extras path now that extras are no longer a separate authorization concept per DEC-08. 7 application files updated to remove the column and its UI surfaces.

#### SEC-04 — Scope `api/share/render` — **DONE**
- **Status:** closed in commit `c6a0c5e` on `feat/phase-0-security-cluster` (2026-05-30).
- **Appendix L:** silent. Reasonable inference: share images should be generatable only for passports the caller can read.
- **Was:** `okujiKobo/app/api/share/render/route.ts:6` accepted any passport id; `Math.random()` token.
- **Resolution:** added 4-branch authorization (owner / published / platform admin / employee at proprietor); returns 404 on no-match (not 403) to avoid leaking existence. Replaced `Math.random()` with `crypto.randomBytes(16).toString('base64url')` — 22-char tokens, ~128 bits of entropy. Existing 8-char tokens in the DB remain valid (`share_tokens.token` is `text/unique`).

#### SEC-05 — Tighten `design-assets` storage upload policy — **DONE**
- **Status:** closed in commit `0c2fab4` on `feat/phase-0-security-cluster` (2026-05-30).
- **Appendix L:** silent. Assets should belong to the owner; cross-user writes are unintended.
- **Was:** baseline insert policy checked only `bucket_id = 'design-assets'`; delete policy enforced folder ownership but insert did not.
- **Resolution:** migration `okujiKobo/supabase/migrations/031_design_assets_storage_policy.sql` drops + recreates `design_assets_upload` with the folder check `(storage.foldername(name))[1] = auth.uid()::text`, matching the existing delete-policy pattern.

#### SEC-06 — Escape user input in `api/share/render` SVG output — **NEW**
- **Surfaced:** during SEC-04 implementation (2026-05-30).
- **Appendix L:** silent.
- **Today:** `okujiKobo/app/api/share/render/route.ts:36-37` interpolates `passport.title` and `profile.display_name` directly into SVG markup with no escaping. A creator could craft a title that contains `<script>` or SVG-event handlers; when a viewer fetches the share image directly (served as `image/svg+xml`), the payload runs in the SVG's origin context.
- **Type:** SEC.
- **Effort:** 0.5 day. HTML-escape both fields before interpolation (`&lt;`, `&gt;`, `&amp;`, `"`, `'`). Better: replace the SVG-via-template-string approach with `@vercel/og` or `node-canvas` per the existing TODO at `route.ts:42`.
- **Dependencies:** none. Independent fix.
- **Risk if deferred:** authenticated XSS in share artifacts. Bounded by who views the raw SVG URL (vs the URL embedded in an `<img>` tag, which is safe), but real.

### FIX (Existing implementation broken or misaligned)

#### FIX-01 — Migrate mobile employee terminal to canonical schema — **DONE**
- **Status:** closed in branch `feat/fix-01-mobile-terminal-unification` (2026-05-30). Commits: migration `898725c`, hook + types `c171025`, employee screens `[scr]`, edge function `09ece7d`, roadmap `[this]`.
- **Appendix L:** L.6 — `employee_authorizations` is the authority.
- **Was:** `app/employee/_layout.tsx`, `app/employee/recent.tsx`, and `hooks/useEmployee.ts` queried the pre-Connect `employee_accounts` table. **Discovery surfaced a second silent break** the synthesis doc had missed: the mobile terminal also operated on `redemption_tokens` while the entire web stack operated on `completion_tokens` — two parallel tables, no rename linking them. Mobile-generated tokens never reached the web admin UI and vice versa.
- **Resolution:** rebuilt onto the canonical schema in a single migration (`032_unify_redemption_into_completion_tokens.sql`) plus mobile code, edge function, and types updates. The migration retires three legacy tables at once (`redemption_tokens`, `employee_accounts`, `proprietors`) because they're tightly coupled FKs; partial retirement would have created new dead references. The user authorized full retirement on the grounds that no serious users exist yet. Detail:
  - **Token schema unified.** `completion_tokens` gained the five mobile-UI columns (`prize_given`, `extra_gift_card_cents`, `distribution_location_id`, `location_whitelist`, `expires_at`) and absorbed any existing `redemption_tokens` rows, mapping legacy `employee_accounts.id` actor references to the underlying `profiles.id` via lookup. The canonical actor column `redeemed_by` / `distribution_logged_by` already FK'd `profiles(id)` — store the human, not the row.
  - **Mobile terminal gate is `can_distribute_prizes`.** Deviated from the original FIX-01 plan (which suggested `can_verify` to match `EmployeeContext`) because the canonical RLS at `012_blockpoint4.sql:394-405` requires `can_distribute_prizes` for any UPDATE to `completion_tokens` — including the redeemed_at write that the scan step performs. A `can_verify`-only gate would have produced silent UPDATE failures at every button click.
  - **Per-institution token prefix** moved from `proprietors.token_prefix` to `institutions.token_prefix`; `generate-token` edge function reads from the canonical source.
  - **Dead code retired:** `components/employee/PrizeDistribution.tsx` and `components/employee/TokenScanner.tsx` had zero importers; the `RedemptionToken`, `EmployeeAccount`, `Proprietor`, and `ProprietorTier` TypeScript types were removed; `lib/qr.ts` token-format regex relaxed from MCM-only to any 1-6 char A-Z/0-9 prefix (per migration 009's per-institution scheme that the mobile validator never caught up to).
- **Scope absorbed:** the "FIX-08 (parallel token tables)" item surfaced in the discovery phase was folded into this PR rather than created as a separate item. `redemption_tokens`, `employee_accounts`, `proprietors` retirements happen here instead of in Phase 6 CLN work.
- **Phase 0 status:** with FIX-01 closed, **Phase 0 is fully closed** modulo the SEC-05 migration production-apply.

#### FIX-02 — Rename or fix `emp_auth_self_update` policy
- **Appendix L:** L.6 — only managers (`can_manage_employees`) and platform admins should modify capability flags. An employee should not self-update their flags.
- **Today:** `okujiKobo/supabase/migrations/014_blockpoint6.sql:148-156` — the policy is named `emp_auth_self_update` but its USING clause permits only admins, the issuing manager, and institution-acting-as-itself. Misleading name; actual behavior is correct-ish (employee cannot self-update), but the manager-pattern is dead (see DEC-16).
- **Type:** FIX (rename + clarify) + CLN (drop the dead institution-pattern clause).
- **Effort:** 1 day.
- **Dependencies:** ~~DEC-16~~ — resolved 2026-05-30.
- **Risk if deferred:** confusion only; not exploitable.
- **DEC-16 resolution (2026-05-30): retire the `institutions.id = auth.uid()` pattern entirely; `can_manage_employees` is canonical.** With that resolution, FIX-02 is cleanup-only: drop the dead `institution-acting-as-itself` clause from the USING expression, leave the admin + manager clauses, rename to `emp_auth_manager_update`.

#### FIX-03 — Multi-institution switching UX
- **Appendix L:** L.7 explicitly says role combinations including "Institution employee at one or more institutions with different capability flags at each" are intended and "all combinations are intended."
- **Today:** `okujiKobo/app/(institutional)/manage/layout.tsx:101-108` and `contexts/EmployeeContext.tsx:75` use `.limit(1).single()` to pick one institution arbitrarily. No UI lets the employee choose.
- **Type:** FIX.
- **Effort:** 3-5 days for a web header dropdown + cookie persistence; 2-3 days for the mobile equivalent.
- **Dependencies:** DEC-04 (UX shape).
- **Risk if deferred:** OK to defer if no beta participant holds memberships at two institutions. A real bug the moment that happens. Likely safe past Phase 2.

#### FIX-04 — Make platform-admin "first institution" deterministic
- **Appendix L:** L.7 — platform admin has clean bypass; no need to "act as" an institution unless explicitly chosen.
- **Today:** `okujiKobo/app/(institutional)/manage/layout.tsx:86-97` runs `SELECT id FROM institutions LIMIT 1` with no ORDER BY. Non-deterministic across multiple institutions.
- **Type:** FIX. Also related to BLD-30 (the institution switcher should serve admins too).
- **Effort:** 1-2 days.
- **Dependencies:** BLD-30 (or, if BLD-30 deferred, fall back to ORDER BY created_at and remember last-chosen via cookie).
- **Risk if deferred:** confusing admin UX with multiple institutions, but no harm.

#### FIX-05 — Replace `profile.role === 'admin'` check in `api/admin/compute-quality-scores` — **DONE**
- **Status:** closed in commit `f30d43f` on `feat/phase-0-security-cluster` (2026-05-30).
- **Appendix L:** L.7 — admin is `is_platform_admin()`.
- **Was:** `okujiKobo/app/api/admin/compute-quality-scores/route.ts:86` checked the legacy `profile.role === 'admin'` string.
- **Resolution:** swapped to the `is_platform_admin()` RPC, matching the pattern in `manage/layout.tsx:81` and `api/institutions/[id]/route.ts:116`.

#### FIX-06 — Change `employee_authorizations` default flag values to `(false, false)` — **DONE**
- **Status:** closed in the Phase 1 PR `feat/phase-1-foundational-schema` (2026-05-30) via migration 033 alongside the BLD-01..04 capability flag additions and the `can_add_extras` retirement.
- **Resolution:** `can_verify` and `can_distribute_prizes` defaults flipped from `true` to `false`. Existing rows retain their current values. Audit pass on both INSERT sites (`access/institutions/[id]/page.tsx` and `(institutional)/manage/employees/page.tsx`) confirmed neither relied on the previous defaults.

#### FIX-07 — Replace `.role === 'employee' || .role === 'admin'` in mobile profile screen
- **Appendix L:** L.7 — admin is `is_platform_admin()`; employee is presence of an `employee_authorizations` row.
- **Today:** `app/(tabs)/profile.tsx:76` reads the legacy mobile-schema role values. They are never set by any code path, so this branch is dead today, but it's confusing.
- **Type:** FIX + CLN.
- **Effort:** 0.5 day.
- **Dependencies:** none.
- **Risk if deferred:** confusion only.
- **DEC-17 resolution (2026-05-30): remove the legacy check; rewire to `EmployeeContext` and `is_platform_admin`.** FIX-07 stays scheduled for Phase 6 as a standalone cleanup (not bundled with FIX-01). Pairs with CLN-01 — same cleanup motion at a different layer.

### BLD (New infrastructure for the target model)

The bulk of the gap. Grouped here by area for readability; sequencing rules in §3.

**B.1 — Capability flags (new columns on `employee_authorizations`)**

#### BLD-01 — Add `can_design` flag — **SCHEMA DONE (Phase 1) + PROVISIONING UI DONE**
- **Status:** column added in migration 033 (2026-05-30) with default `false`. Provisioning checkbox added to both employee rosters (`/access/institutions/[id]` and `/manage/employees`) in `feat/institution-access-completion` (2026-05-30). Enforcement in `api/design/create` is still Phase 2. RLS expansion that already uses this flag is migration 038.
- **Appendix L:** L.6 — gates designing under the institution's name. L.9 — institutional employee path requires this.
- **Today:** does not exist. `okujiKobo/app/api/design/create/route.ts:10-49` checks only `getUser()`.
- **Type:** BLD.
- **Effort:** 1 day for the migration + form UI checkbox; 0.5 day for the API gate enforcement (Phase 2).
- **Dependencies:** none for the schema; the gate enforcement depends on BLD-06 (trial limits decision for Free) and DEC-03 (DB vs app enforcement).

#### BLD-02 — Add `can_manage_employees` flag — **SCHEMA DONE (Phase 1) + PROVISIONING UI DONE**
- **Status:** column added in migration 033 (2026-05-30) with default `false`. Provisioning checkbox added to both employee rosters in `feat/institution-access-completion` (2026-05-30). Enforcement at `/manage/employees` and `api/employees/lookup` is still Phase 2 (SEC-02).
- **Appendix L:** L.6.
- **Today:** does not exist. The `/manage/employees` UI is gated only on "have any institution membership."
- **Type:** BLD.
- **Effort:** 1 day schema + UI; 1-2 days for migration of existing employees (audit: should `authorized_by` employees be auto-granted? Likely yes).
- **Dependencies:** DEC-16 (manager mechanism). Also unblocks SEC-01 and SEC-02.

#### BLD-03 — Add `can_view_analytics` flag — **SCHEMA DONE (Phase 1) + PROVISIONING UI DONE**
- **Status:** column added in migration 033 (2026-05-30) with default `false`. Provisioning checkbox added to both employee rosters in `feat/institution-access-completion` (2026-05-30). Enforcement at `api/analytics/[passportId]` is still Phase 2.
- **Appendix L:** L.6.
- **Today:** does not exist. `okujiKobo/app/api/analytics/[passportId]/route.ts:94-107` allows any employee.
- **Type:** BLD.
- **Effort:** 1 day schema + UI + route gate.
- **Dependencies:** none for schema; enforcement is just the API gate.

#### BLD-04 — Add `can_manage_billing` flag — **SCHEMA DONE (Phase 1) + PROVISIONING UI DONE**
- **Status:** column added in migration 033 (2026-05-30) with default `false`. Provisioning checkbox added to both employee rosters in `feat/institution-access-completion` (2026-05-30). Enforcement still deferred to Phase 4 (billing UI doesn't exist to gate yet).
- **Appendix L:** L.6.
- **Today:** does not exist; no billing UI to gate.
- **Type:** BLD.
- **Effort:** 1 day schema + UI. Enforcement deferred until Phase 4 has something to gate.
- **Dependencies:** none for schema.

**B.2 — Institution tier classification**

#### BLD-05 — Add `tier` column on `institutions` — **DONE**
- **Status:** column added in migration 034 (2026-05-30) with CHECK (`'civic'|'municipal'|'business'|'pending'`), default `'pending'`. Tier dropdown wired into both the AddInstitutionDialog and the `/access/institutions/[id]` edit form in `feat/institution-access-completion` (2026-05-30) — Nathan can now set tier through the platform-admin UI per DEC-02 with no SQL editing. `InstitutionTier` type drift fixed in the same PR (was still claiming the legacy `community|commercial|enterprise` values).
- **Important coexistence note:** `institutions.tier` (org-category axis, Appendix L) and `institutions.pricing_model` (free|paid_passport|community|regional|enterprise|patron, computed from type+admission+population) are **independent fields**. A future pricing model will consume tier as ONE input — tier AFFECTS pricing but does NOT determine it. Civic ≈ free; Municipal pricing is a function of `municipality_population`; Business pricing is a function of `annual_revenue` and `marketing_spend` (the latter two added as nullable inputs in migration 041, captured-only). The pricing model itself is deliberately deferred until real deal data exists.
- **Appendix L:** L.5 — Civic / Municipal / Business sub-tiers.
- **Today:** does not exist. No tier-aware behavior.
- **Type:** BLD.
- **Effort:** 2-3 days. Migration + form UI + tier-aware feature gates (mostly trivial: Civic = no billing UI; Municipal/Business = billing UI; Business = custom-branding UI). Backfill: every existing institution gets manually classified.
- **Dependencies:** ~~DEC-02~~ — resolved 2026-05-30.
- **DEC-02 resolution (2026-05-30): manual review by Nathan for all institutional sign-ups in v1.** No tier-assignment-at-signup logic; Nathan sets the tier when creating the institution row through the platform-admin UI. Simplifies BLD-05 — the column is set on creation, never derived. Self-service onboarding deferred until volume justifies (BLD-29).

**B.3 — Subscription state**

#### BLD-07 — Add Pro subscription state — **SCHEMA DONE (Phase 1)**
- **Status:** `pro_status`, `pro_source`, and the carried-forward `pro_expires_at` exist on `profiles` as of migration 035 (2026-05-30). `comp_subscriptions` writes here via the trigger in 036. Capability detection in `lib/roles.ts` is Phase 2; paid integration is Phase 4 (BLD-25).
- **Appendix L:** L.3.
- **Today:** does not exist. `profiles.pro_expires_at` column exists (web schema) but unused.
- **Type:** BLD.
- **Effort:** 2-3 days for schema (status column, expires_at, source = 'paid' | 'comp'), capability detection in `lib/roles.ts`, basic UI badge.
- **Dependencies:** none for the state model; actual payment integration is BLD-25.

#### BLD-08 — Add Studio subscription state — **SCHEMA DONE (Phase 1)**
- **Status:** `studio_status`, `studio_source`, `studio_expires_at` exist on `profiles` as of migration 035 (2026-05-30). Mirror of BLD-07. Capability detection in `lib/roles.ts` is Phase 2.
- **Appendix L:** L.4.
- **Today:** does not exist.
- **Type:** BLD.
- **Effort:** 2-3 days. Same shape as BLD-07.
- **Dependencies:** none for the state model. Critical to BLD-12 (comps) — the comp subscription writes here.

#### BLD-12 — `comp_subscriptions` table + admin grant UI — **DONE**
- **Status:** closed in the Phase 1 PR `feat/phase-1-foundational-schema` (2026-05-30). Migration 036 ships the table with admin-only RLS and the `sync_comp_to_profile` trigger. Admin UI at `/access/comp-subscriptions` provides grant + revoke. Comp grants automatically propagate to `profiles.{pro,studio}_status` via the trigger.
- **Appendix L:** L.8 — ambassador program prerequisite.
- **Today:** does not exist.
- **Type:** BLD.
- **Effort:** 3-5 days. Table (`id, user_id, tier ('pro'|'studio'), granted_by, granted_at, expires_at, revoked_at, note`), admin grant/revoke UI under `/access`, integration with BLD-07/08 so the comp drives the user's effective subscription state.
- **Dependencies:** BLD-07 + BLD-08 (the state model that comps target).
- **Risk if deferred:** cannot start ambassador program. This is the *enabler*, not the program itself.

**B.4 — Designer access gating**

#### BLD-06 — Free-tier trial limits (3 passports, 12 pages)
- **Appendix L:** L.2.
- **Today:** no limit. Any authenticated user can create unlimited passports of any page count.
- **Type:** BLD.
- **Effort:** 3-5 days. Server-side enforcement: count user's owned passports (excluding institution-owned) at `api/design/create`; reject if >= 3 for non-Pro/non-Studio/non-institution-employee-with-can_design. Page-count enforcement at `api/passport_pages` creation. UI affordance to surface "upgrade to Pro" when limit hit.
- **Dependencies:** DEC-03 (DB vs app enforcement), BLD-07 + BLD-08 (to know who is exempt), BLD-01 (can_design exempts).

#### BLD-09 — Private/invite-only passport mechanism
- **Appendix L:** L.3 — Pro creators publish private/invite-only with codes.
- **Today:** passports are binary `is_published` true/false. No invite-code gate.
- **Type:** BLD.
- **Effort:** 4-7 days. Schema: `passport.visibility ('draft'|'private'|'public')`, `passport_invite_codes` table. Acquire flow: when visibility = 'private', require a code on `api/acquire`. UI: code-generation page for Pro creators, code-entry surface in marketplace/mobile.
- **Dependencies:** BLD-07 (Pro state, since private publishing is a Pro privilege).

#### BLD-10 — Public marketplace gate
- **Appendix L:** L.4 + L.9 — only Studio subscribers and institutional employees with `can_design` can publish to the public marketplace.
- **Today:** `passports.is_published = true` is the gate; anyone can flip it.
- **Type:** BLD.
- **Effort:** 2-3 days. Server-side check on the publish path: caller must be Studio (BLD-08) OR have `can_design` on an institution (BLD-01). Marketplace listing query filters on `visibility = 'public'`.
- **Dependencies:** BLD-08, BLD-01, BLD-09 (the visibility column).

#### BLD-24 — Studio creator badge
- **Appendix L:** L.4.
- **Today:** scaffolding for "Design Certified" badge exists (`okujiKobo/components/marketplace/PassportCard.tsx:70`) but the field is hardcoded `false`. Reuse-able.
- **Type:** BLD (small).
- **Effort:** 1 day. Repoint the badge at the creator's Studio status.
- **Dependencies:** BLD-08.

#### BLD-22 — Premium asset library
- **Appendix L:** L.4.
- **Today:** `design_assets` table with `is_built_in` flag. Used as universal-access for built-ins.
- **Type:** BLD.
- **Effort:** 3-5 days. Add `tier_required` column ('free'|'studio'|'business'); gate the asset picker accordingly. Curation work (selecting/uploading the premium assets) is separate.
- **Dependencies:** BLD-08 + BLD-05 to know who qualifies.

#### BLD-23 — Larger draft library
- **Appendix L:** L.4. Free/Pro have a draft cap; Studio is unlimited.
- **Today:** no draft cap exists. **All users currently have unlimited drafts.** Free-tier 3-passport cap (BLD-06) effectively caps Free; Pro has no implementation today; Studio has no implementation.
- **Type:** BLD or DEC.
- **Effort:** 1-2 days if a draft cap is wanted; 0 if accepting "Pro can have unlimited drafts too" and only Free is capped via BLD-06.
- **Dependencies:** DEC required — is BLD-23 really wanted, or is BLD-06's Free cap sufficient gating? **Marked as DEC-XX below.**

**B.5 — Custom branding (Studio + Business)**

#### BLD-11 — Custom branding on passports
- **Appendix L:** L.4 (Studio: creator's name/logo) and L.5 Business (full custom branding, no Okuji co-brand).
- **Today:** does not exist.
- **Type:** BLD.
- **Effort:** 1-2 weeks. Cover branding fields on `passports` (creator_logo_url, creator_name_display, hide_okuji_brand boolean). Renderer changes in book reader and print PDF. UI in designer inspector. Tier-gated visibility.
- **Dependencies:** BLD-05, BLD-08.

**B.6 — Pro consumer features (defer past v1 beta — see §5)**

#### BLD-17 — Family/household account linking
- **Appendix L:** L.3.
- **Effort:** 3-5 weeks (account-linking model, shared-passport semantics, invite + accept flow, family view in the mobile app).
- **Dependencies:** BLD-07 (Pro state), DEC-12.

#### BLD-18 — Group features (friend invitations, group challenges, shared journals)
- **Appendix L:** L.3.
- **Effort:** 4-6 weeks. Substantial — touches journal sharing, presence, challenge passports.
- **Dependencies:** BLD-07.

#### BLD-19 — Multi-passport timeline + annual recap
- **Appendix L:** L.3.
- **Effort:** 2-3 weeks. Read-only analytics view.
- **Dependencies:** BLD-07.

#### BLD-20 — Search across journals
- **Appendix L:** L.3.
- **Effort:** 1-2 weeks. Likely Postgres full-text search since the data volume is small.
- **Dependencies:** BLD-07.

#### BLD-21 — Tag and organize collections
- **Appendix L:** L.3.
- **Effort:** 1-2 weeks. Tags table, UI, filter affordances.
- **Dependencies:** BLD-07.

#### BLD-16 — Heritage Edition print discount
- **Appendix L:** L.3, L.10.
- **Effort:** unknown — depends on print partner negotiation. The technical implementation (apply discount code at checkout) is 1-2 weeks; the partnership work is external.
- **Dependencies:** print-partner contract (out of scope here); BLD-07.

**B.7 — Subscription billing (deferred — see §7)**

#### BLD-25 — Pro/Studio billing
- **Appendix L:** L.3, L.4.
- **Effort:** 2-3 weeks of focused work. Stripe Products, Prices, Subscriptions, webhook handling, dunning, cancel/resume, prorated upgrades.
- **Dependencies:** **Deferred Stripe work**. Cannot start until that block lifts. BLD-07, BLD-08 must exist first.

#### BLD-26 — Institutional billing (Municipal + Business)
- **Appendix L:** L.5.
- **Effort:** 2-3 weeks. Municipal is mostly self-serve at $25-100/mo; Business is custom invoiced (may not need automation in v1 — Stripe Invoices is enough). Dependencies of subscription on tier classification.
- **Dependencies:** **Deferred Stripe work**, BLD-05, BLD-04 (`can_manage_billing`).

#### BLD-27 — Revenue split + payouts (70/30)
- **Appendix L:** L.4.
- **Effort:** 2-4 weeks. Stripe Connect, KYC, payout accounting, 1099 reporting at year-end. Significant compliance surface.
- **Dependencies:** **Deferred Stripe work**, BLD-08.

**B.8 — Quality and analytics (Phase 5)**

#### BLD-13 — Creator analytics dashboard
- **Appendix L:** L.4 — acquisition counts, completion rates, ratings, engagement heatmaps, drop-off.
- **Today:** `api/analytics/[passportId]` exists but is institution-scoped and has no UI for individual creators.
- **Type:** BLD.
- **Effort:** 2-3 weeks. Read-side dashboard pulling from `acquisitions`, `stamps`, `completion_tokens`. Heatmaps need design work.
- **Dependencies:** BLD-08 (Studio state — Free/Pro creators do not get this dashboard).

#### BLD-14 — 1-5 star collector ratings
- **Appendix L:** L.4 — optional ratings, no review text to moderate.
- **Today:** does not exist.
- **Type:** BLD.
- **Effort:** 1-2 weeks. `passport_ratings (user_id, passport_id, stars, created_at)` table, post-completion prompt in mobile, aggregation, exposure on marketplace.
- **Dependencies:** none functionally; logically belongs after BLD-13.

#### BLD-15 — Reactive quality monitoring + flag-for-review
- **Appendix L:** L.4.
- **Today:** does not exist.
- **Type:** BLD.
- **Effort:** 2-3 weeks. Behavioral-signal computation (completion rate, time-to-complete, journal-engagement), threshold check (DEC-05), `creator_quality_scores` already exists in schema — repurpose. Flag UI for admins, "no new publishes during review" gate on `api/design/create` / publish path. Decision UI: clear / require changes / suspend / remove.
- **Dependencies:** BLD-13, BLD-14, DEC-05.

#### BLD-28 — Optional pre-publish review
- **Appendix L:** L.4 — opt-in for Studio creators.
- **Type:** BLD.
- **Effort:** 1-2 weeks. Request-review button on draft passport; admin review queue; comment-back mechanism.
- **Dependencies:** BLD-08.

**B.9 — Other**

**B.9 — Institutional onboarding**

#### BLD-31 — Institutional request form (light v1)
- **Appendix L:** L.5 (per the v1 onboarding-model paragraph in the operations doc).
- **Today:** does not exist. There is no public path for a prospective institution to surface itself; institutions arrive through Nathan's network.
- **Type:** BLD.
- **Effort:** 1-2 days.
- **Dependencies:** none.
- **Cross-reference:** DEC-02 resolution.

  **Scope (light v1, deliberately minimal):**
  - A separate page reachable from the consumer sign-up page via a link labeled "Request institutional access."
  - Form fields: institution name; institution type (dropdown: school / library / museum / nonprofit / municipality / business / other); submitter's name; submitter's role; submitter's work email; free-text description of intended use (500 char limit).
  - Backed by a single new table `institution_requests` (id, name, type, contact_name, contact_role, contact_email, description, status, created_at, notes, nullable `institution_id` FK once the institution is created).
  - Status enum: `pending` (just submitted) → `contacted` (Nathan reached out) → `in_progress` (active conversation) → `approved` (institution created) or `declined` (with notes).
  - Admin UI at `/access/institution-requests`: list view of pending + recent submissions, click for detail, update status via dropdown, add internal notes.
  - Notifications: email to `nathan@okuji.app` on new submission (functional, not templated). Optional confirmation email to the submitter setting a "we'll be in touch within 2 business days" expectation.

  **Deliberately NOT in v1:** spam protection beyond basic email format validation; automated approval workflow; public status checking for the submitter; file uploads (letterhead, 501c3 documentation); multi-step form; submission-rate analytics; integration with the institution-creation flow beyond the manual `institution_id` FK.

  **Related task (not part of BLD-31 itself, ~5 minutes):** add a line of copy to the consumer sign-up page directing institutions to `nathan@okuji.app`. Recommended phrasing: *"Okuji partners with schools, libraries, museums, parks, towns, and businesses. To explore an institutional partnership, email nathan@okuji.app."*

  **Resist scope creep.** Additional fields and features get added later based on actual usage signal, not anticipation.

#### BLD-29 — Civic institution self-enrollment flow (teacher → school) — **DEFERRED INDEFINITELY**
- **Appendix L:** L.5 — structural decision locked; workflow design is future work.
- **Type:** BLD.
- **Effort:** 2-4 weeks. Enrollment UI, school-verification step (DEC-07), duplicate detection (multiple teachers from the same school), admin-role transition.
- **Dependencies:** BLD-05, DEC-07.
- **DEC-02 resolution (2026-05-30): manual review by Nathan for all institutional sign-ups in v1.** Institutions do not self-onboard through a public flow until volume justifies it. BLD-29 stays scheduled in Phase 7 (or beyond) rather than within Phases 0-6. BLD-31 provides the light intake mechanism that handles institutional interest in the meantime.

#### BLD-30 — Multi-institution switcher UX
- **Appendix L:** L.7.
- **Type:** BLD (overlaps with FIX-03 — that is the bug; this is the proper feature).
- **Effort:** 3-5 days web + 2-3 days mobile.
- **Dependencies:** DEC-04.

**B.10 — Operational and mobile UX**

#### BLD-32 — Per-passport demo mode — **DONE**
- **Status:** closed in `feat/bld-32-33-demo-mode-voice-camera` (2026-05-30). Migration `039_passports_is_demo.sql` adds `passports.is_demo`; mobile `app/passport/[id].tsx` implements admin detection, banner, bypass, and an admin-only toggle pill.
- **Appendix L:** silent. Operational tooling, not a tier capability.
- **Today:** does not exist. Running a demo of the stamp flow at a venue requires either physically standing at each stop or hand-crafting fake stamp rows in SQL — neither is acceptable for a sales conversation.
- **Resolution:** single boolean `passports.is_demo` flag. When a platform admin views a passport with `is_demo = true`, the stamp flow bypasses GPS verification, the acquisition gate (auto-creates a `collector_passports` row for the admin if needed), stop ordering, and capability flags. A persistent red banner ("DEMO MODE — constraints bypassed") and an admin-only toggle pill render on the passport view. Non-admins viewing the same passport get normal behavior (no bypass, no banner) — the flag is an admin-only override, not a relaxation of the public access model.
- **No is_demo_data tagging on stamps / journal_entries / journal_photos** per locked spec — the deployment plan is to `TRUNCATE` demo passports + their `collector_passports` + dependent rows before going live. Demo stamps are recorded with `verification_method = 'self_reported'` (existing enum value; honest about the lack of GPS verification) and `geohash = NULL`.

#### BLD-33 — Voice journal 30-second cap — **DONE**
- **Status:** closed in `feat/bld-32-33-demo-mode-voice-camera` (2026-05-30). `components/journal/VoiceRecorder.tsx` switches to `continuous: true` and enforces a hard 30 s cap via setTimeout that calls `ExpoSpeechRecognitionModule.stop()`.
- **Appendix L:** silent. Operational guardrail.
- **Today:** the voice recorder had no duration cap. `continuous: false` would end recognition at the first natural pause but allowed indefinite re-starts.
- **Resolution:** `MAX_RECORDING_MS = 30_000` enforced by a JS timer started on `start()` and cleared on the `end` / `error` events and on unmount. `continuous: true` is the coupled change — the previous `continuous: false` would have truncated a reflective 30-second entry the moment the user breathed. A minimal countdown ("Listening… 23s left") replaces the static hint. No waveform, no three-state mic UI per scope guards.

#### Related: live camera capture in journaling + unified post-stamp capture surface
Not separately numbered — shipped alongside BLD-32 / BLD-33:
- `components/journal/JournalEntry.tsx` adds `addFromCamera` via `ImagePicker.launchCameraAsync` (same asset shape, same enqueue pipeline as the existing library picker). UI now offers two side-by-side buttons: "📷 Take photo" and "🖼 Choose existing". Either, both, or neither.
- `components/passport/PostStampCaptureSheet.tsx` replaces the previous post-stamp Alert in Flow A. Thin Modal wrapper around `<JournalEntry>`; voice + photo are independently optional. Page-completion redemption token displayed as a navy banner above the journal primitives when present. The standalone `/journal/[stampId]` modal route is untouched (it remains the read-existing path).

#### BLD-34 — Expressive stamp gesture (proxy version) — **DONE (wired 2026-05-30)**
- **Status:** closed in `feat/expressive-stamp-gesture` (2026-05-30). Migration `040_stamp_appearance.sql` adds `stamps.saturation` + `stamps.smudge_dx / smudge_dy / smudge_intensity`. New mobile component `components/stamp/StampGestureInteraction.tsx` computes the gesture; old `components/passport/StampingOverlay.tsx` modal deleted.
- **Wiring fix (2026-05-30, `feat/wire-bld-34-gesture`):** the initial BLD-34 PR wired `StampGestureInteraction` into `components/passport/LocationBox.tsx`, which a read-only investigation revealed was orphaned — its only importer (`GeographicSection.tsx`) had zero importers itself. The active collector path went through `DesignerLocationBox → StampPressInteraction` (legacy). Stamps placed between the two PRs wrote NULL into the migration-040 columns and rendered via the legacy fallback. The wiring PR swapped `StampPressInteraction → StampGestureInteraction` inside `DesignerLocationBox` and deleted the orphaned trio. New stamps now populate `saturation` / `smudge_dx` / `smudge_dy` / `smudge_intensity` from the gesture as designed.
- **Appendix L:** silent. UX work.
- **Today (post-PR):** single press-and-hold on a stop's LocationBox (no modal confirmation step) computes three appearance properties from a 2-second window: SIZE + SATURATION from press duration (eased with `easeOutCubic`), ROTATION from the finger's initial drift direction within the first ~200 ms, SMUDGE (directional motion-blur trail) from the total path traveled during the press. Live preview renders the growing stamp at the touch start position throughout the gesture. On release or at the 2 s cap, the placement is committed via the existing INSERT path with the new appearance columns populated.
- **Framing — proxies vs true geometry:** SIZE and ROTATION are **proxies** (duration and initial-vector readings of a single fingertip touch), NOT measured fingertip contact area or contact-ellipse angle. This implementation does not practice the contact-size-to-stamp-size scaling mechanic described in the business plan's patent appendix — that requires native contact-geometry reads (`majorRadius` / `getTouchMajor` / `getOrientation`) and is deferred ("Path A"). SMUDGE (movement-based) is a real read of the gesture.
- **Easing choice:** `easeOutCubic` for duration→size and duration→saturation. Ramps up faster early, settles approaching the cap. Quad/quint variants were considered; cubic felt most physical in spec.
- **Scope guards observed:** no native module, no expo prebuild, no force-touch APIs, no changes to verification logic or the demo bypass. Center-within-box rule preserved (delegated to `computeStampPlacement`). Flow B (`app/passport/stamp/[stopId]`) untouched.
- **Legacy preservation:** pre-040 stamps render exactly as before — `StampArtwork` falls back to the discrete `stops.stamp_smudge` enum when all four new fields are null. `StampSlot` and `StampCanvas` read the new fields when present and use stored `contact_size_px` for the rendered stamp size.
- **What got retired:** `components/passport/StampingOverlay.tsx` (modal confirmation step, replaced by in-LocationBox gesture); `defaultPlacement()` helper in `app/passport/[id].tsx` (no longer needed — the gesture fills in posX/posY/contactSizePx/rotationDeg).
- **What got kept as deferred-future:** `components/stamp/StampPressInteraction.tsx` remains in place as the Path-A target for native contact-geometry reads when that's wanted.

### CLN (Cleanup, dead code, redundancy)

#### CLN-01 — Retire unreachable `profiles.role` values
- **Today:** `'creator' | 'employee' | 'admin'` in CHECK; none written by code.
- **Type:** CLN + DEC.
- **Effort:** 1 day.
- **Dependencies:** DEC-01 (retire or keep as legacy?).
- **DEC-17 resolution note (2026-05-30):** the mobile profile-screen `.role === 'employee'` check is being removed in FIX-07 (rewired to `EmployeeContext` + `is_platform_admin`). CLN-01 retires the same legacy values at the database CHECK layer — same cleanup motion at a different layer.

#### CLN-02 — Remove `'designer'` from `connect_roles`
- **Today:** declared but unreachable; no entry path.
- **Type:** CLN.
- **Effort:** 0.5 day.
- **Dependencies:** confirmation that designer is not a planned tier.

#### CLN-03 — Decide and clean up "Design Certified" badge
- **Today:** scaffolding exists; `creator_is_certified` is hardcoded `false`.
- **Type:** CLN.
- **Effort:** 0.5 day if removing; folded into BLD-24 if repointing at Studio badge.

#### CLN-04 — Drop `is_admin()` wrapper
- **Today:** `is_admin()` is a one-line alias of `is_platform_admin()`. Both exist.
- **Type:** CLN.
- **Effort:** 1-2 days. Migration to drop and rename all policy bodies. Touches many policies.

#### CLN-05 — Drop redundant `institutions_admin_read` policy
- **Today:** redundant with `institutions_public_read` after migration 026.
- **Type:** CLN.
- **Effort:** 0.5 day.

#### CLN-06 — Consolidate the three migration trees
- **Today:** `supabase/migrations/`, `okuji-db/supabase/migrations/`, `okujiKobo/supabase/migrations/` disagree on `profiles` shape and trigger definitions.
- **Type:** CLN + DEC.
- **Effort:** ~~1-2 weeks~~ → **~1 day** (revised after DEC-19 resolution). Documentation-and-archive task: write a `README.md` at the canonical tree, mark the others as historical, do not modify their contents.
- **Dependencies:** ~~DEC-19~~ — resolved 2026-05-30.
- **DEC-19 resolution (2026-05-30): `okujiKobo/supabase/migrations/` is canonical.** The mobile `supabase/migrations/` tree is historical (applied at points in production; no new migrations land there). `okuji-db/supabase/migrations/000_baseline.sql` becomes reference documentation. CLN-06 narrows from a consolidation effort to a documentation task: add `okujiKobo/supabase/migrations/README.md` stating the canonical-tree decision (recommended to land as part of Phase 1's first migration PR), and update the mobile and `okuji-db` trees with a top-of-tree note pointing at the canonical location.

#### CLN-07 — Drop coexisting mobile-baseline RLS policies superseded by web
- **Today:** `passports_creator_manage` (mobile) coexists with `passports_creator` (web), etc. Union of permissions; not broken but confusing.
- **Type:** CLN.
- **Effort:** 2-3 days (audit + drop migration).
- **Dependencies:** CLN-06.
- **DEC-19 resolution note (2026-05-30):** with `okujiKobo/supabase/migrations/` confirmed canonical, CLN-07 is unblocked — the redundant mobile-baseline policies can be dropped in a migration in the canonical tree without ambiguity about which side is authoritative.

#### CLN-08 — Drop dead `emp_auth_manager_*` policies
- **Today:** depend on `institutions.id = auth.uid()` pattern that no code creates.
- **Type:** CLN.
- **Effort:** 1 day.
- **Dependencies:** ~~DEC-16~~ — resolved 2026-05-30; BLD-02 (`can_manage_employees` is the replacement).
- **DEC-16 resolution note (2026-05-30):** the `institutions.id = auth.uid()` manager pattern is retired. CLN-08 is unblocked — drop the dead `emp_auth_manager_*` policies that referenced the UID pattern. The `institutional_manager` branch in `okujiKobo/lib/roles.ts:76-92` is also dead and gets cleaned up in the same Phase 6 pass.

#### CLN-09 — Comment or rename `role_label` for clarity
- **Today:** free-text display column; readers assume it has authorization meaning.
- **Type:** CLN.
- **Effort:** 0.5 day.

### DEC (Decisions required before implementation)

These are not work items — they are product decisions that must be made before the relevant implementation work can proceed. Surfaced here so the user can resolve them in a separate pass.

**Six DECs were resolved on 2026-05-30.** They remain in this table for traceability; resolutions are summarized inline and detailed in §6.

| # | Decision | Status |
|---|---|---|
| **DEC-01** | Retire `profiles.role` CHECK values (`creator | employee | admin`), or keep as legacy for mobile compatibility? | open |
| **DEC-02** | Institution-tier assignment at sign-up — self-attest, admin manual review, or auto-by-email-domain? Appendix L L.5 silent. | ✅ **resolved 2026-05-30: manual review by Nathan in v1.** No public self-service onboarding; Nathan reviews each inquiry, qualifies, signs terms, and provisions the row. See BLD-31 for the light intake mechanism. |
| **DEC-03** | Trial-passport limit (3/12) enforcement — database CHECK / trigger, or application-layer counter? | open |
| **DEC-04** | Multi-institution switching UX — header dropdown (persistent cookie), separate URLs, switcher modal? | open |
| **DEC-05** | Quality-monitoring threshold — what numeric scores or behavioral patterns trigger flag-for-review? Appendix L L.10 open. | open |
| **DEC-06** | Religious-institution boundary — faith-based schools, historic religious sites, secular-with-religious-affiliation. Appendix L L.5 + L.10 open; legal review required. | open |
| **DEC-07** | Civic-onboarding verification — what confirms a self-enrolling user is a real K-12 employee and the school is real? Appendix L L.10 open. | open |
| **DEC-08** | Keep `can_add_extras`, fold into `can_distribute_prizes`, or retire? Appendix L silent. | ✅ **resolved 2026-05-30: fold into `can_distribute_prizes`.** Anyone trusted to redeem prizes is trusted to add extras. Column retired in Phase 1. Simplifies SEC-03 and FIX-06. |
| **DEC-09** | Studio price point (pending ambassador data per L.10). | open |
| **DEC-10** | Municipal-tier price tiers by city population (L.10). | open |
| **DEC-11** | Heritage Edition print partner (L.10). | open |
| **DEC-12** | Pro split into individual vs family tiers, or single tier (L.10). | open |
| **DEC-13** | Loyalty grandfather for existing collectors at Pro launch (L.10). | open |
| **DEC-14** | Suspension/denial mechanism design (L.10). | open |
| **DEC-15** | Finer-grained platform admin roles when team grows (L.7, L.10). | open |
| **DEC-16** | Institutional-manager mechanism — replace `institutions.id = auth.uid()` pattern entirely with `can_manage_employees`? (Recommended per Appendix L.6 + L.7.) | ✅ **resolved 2026-05-30: replace.** The UID pattern is retired; `can_manage_employees` is canonical. Simplifies FIX-02 to cleanup-only; unblocks CLN-08 + `institutional_manager` branch in `lib/roles.ts`. |
| **DEC-17** | Should the mobile-only `profile.role === 'employee'` check be removed in favor of `EmployeeContext`? (Companion to CLN-01.) | ✅ **resolved 2026-05-30: remove.** Rewire to `EmployeeContext` + `is_platform_admin`. FIX-07 stays Phase 6 (not bundled with FIX-01); pairs with CLN-01 at the database layer. |
| **DEC-18** | Should institutional employees with `can_design` be able to edit passports owned by their institution? Currently only `creator_id` can. Critical for institutional teams where the creator and the editor are different people. | ✅ **resolved 2026-05-30: yes, when `proprietor_id IS NOT NULL`.** Any employee with `can_design` at the proprietor institution can edit any institution-owned passport. Personal (non-institutional) passports retain strict `creator_id`-only edit rights. RLS update on `passports`, `passport_pages`, `stops`, and related tables (OR the existing `creator_id = auth.uid()` clause with an employment + `can_design` clause, only when `proprietor_id IS NOT NULL`). Schema additions for lightweight audit: nullable `last_edited_by` (uuid) and `last_edited_at` (timestamptz) on `passports`, written by application code on save. Lands in Phase 1 with the rest of the foundational schema. |
| **DEC-19** | Canonical migration tree for greenfield deploys (CLN-06 prerequisite). | ✅ **resolved 2026-05-30: `okujiKobo/supabase/migrations/` is canonical.** Mobile `supabase/migrations/` is historical; `okuji-db/.../000_baseline.sql` is reference. CLN-06 narrows to a documentation task. A `README.md` recording this should land at the canonical tree as part of Phase 1's first migration PR. |
| **DEC-20** | Is BLD-23 (separate draft cap) wanted, or is BLD-06's Free 3-passport cap sufficient? | open |

---

## Section 3 — Recommended sequencing

### Phase 0 — Pre-beta security and correctness — **DONE**

**Goal:** the system as it exists today does not leak data or silently malfunction for institutional partners.

**Originally:** SEC-01, SEC-02 (with admin-only fallback), SEC-04, SEC-05, FIX-01, FIX-05, FIX-06. SEC-03 deferred to Phase 1.

**Final status (2026-05-30):**
- ✅ **Closed in code:** SEC-01, SEC-04, SEC-05 (`feat/phase-0-security-cluster`); SEC-06 (`feat/phase-0-closeout`); FIX-01 (`feat/fix-01-mobile-terminal-unification`); FIX-05 (security cluster).
- ↪︎ **Reclassified out of Phase 0** (not closed; intentionally moved): SEC-02 → Phase 2 (admin-only fallback never proved necessary at beta scale); SEC-03 → Phase 1 (closes alongside the `can_add_extras` retirement migration + a one-line drop of the API check at `okujiKobo/app/api/token/redeem/route.ts:128-135`); FIX-06 → Phase 1 (folded with other migration work); FIX-07 → Phase 6 (paired with CLN-01 at the database layer).
- 🎁 **Pulled forward into FIX-01's PR (was scheduled for Phase 6 CLN):** retirement of three legacy tables (`redemption_tokens`, `employee_accounts`, `proprietors`) plus deletion of `components/employee/PrizeDistribution.tsx` + `TokenScanner.tsx`. They were tightly FK-coupled to FIX-01's migration; partial retirement would have created new dead references.

**Operational tail:** apply migrations `031_design_assets_storage_policy.sql` and `032_unify_redemption_into_completion_tokens.sql` to production. After migration 032, confirm via `psql` that `redemption_tokens`, `employee_accounts`, and `proprietors` no longer exist and that `institutions.token_prefix` is populated for any McMenamins-historical rows. The `generate-token` edge function needs a redeploy because the mobile-Supabase function tree has not been the canonical source per DEC-19 — its updated copy lives in this PR's branch and ships when the function is deployed.

**Rationale:** SEC items affect the system AS IT IS — they are not about future features. FIX-01 was a silent production break.

**Dependencies:** none external.

### Phase 1 — Foundational schema and capability infrastructure — **DONE**

**Goal:** every column, table, and flag that Appendix L's tier system needs exists in the schema, with no enforcement yet. Enforcement comes in subsequent phases without further migrations.

**Status (2026-05-30):** all items shipped on `feat/phase-1-foundational-schema`. Migrations `033` through `038`. Comp admin UI at `/access/comp-subscriptions`. Canonical-tree README at `okujiKobo/supabase/migrations/README.md`.

**Items shipped:**
- ✅ **BLD-01..04** — `can_design`, `can_manage_employees`, `can_view_analytics`, `can_manage_billing` on `employee_authorizations`; all default `false` (migration 033).
- ✅ **BLD-05** — `institutions.tier` with CHECK constraint `('civic'|'municipal'|'business'|'pending')`, default `'pending'` (migration 034). Per DEC-02, Nathan sets tier manually through the platform-admin UI.
- ✅ **BLD-07, BLD-08** — `pro_status`, `pro_source`, `pro_expires_at` (carried), `studio_status`, `studio_source`, `studio_expires_at` on `profiles` (migration 035).
- ✅ **BLD-12** — `comp_subscriptions` table + admin-only RLS + `sync_comp_to_profile` trigger that keeps `profiles.{pro,studio}_status` derived (migration 036). Comp admin UI at `/access/comp-subscriptions`.
- ✅ **DEC-18 audit** — `last_edited_by` / `last_edited_at` on `passports` + `BEFORE UPDATE` trigger that sets them from `auth.uid()` and `now()` (migration 037). **Trigger-based, deviating from the original plan's app-layer instruction** — justified by discovery surfacing ~19 passport UPDATE call sites including many direct PostgREST client calls. Service-role API routes (tip arrival, acquire arrival, completion notification, admin recompute) produce `last_edited_by = NULL` since `auth.uid()` is null under service role, which is the desired semantic for system-driven derived-counter updates.
- ✅ **DEC-18 RLS expansion** — `passports`, `passport_pages`, `stops`, `passport_autosaves`, `print_jobs`, `design_assets` (migration 038). Allows employees with `can_design` at the owning institution to edit/delete. Scoped to `proprietor_id`/`institution_id IS NOT NULL` so personal content retains strict owner-only semantics.
- ✅ **DEC-08 / SEC-03 closure** — `can_add_extras` column dropped (migration 033). API check at `okujiKobo/app/api/token/redeem/route.ts` removed. UI surfaces cleaned across 7 files: institutional terminal extras section now gates on `can_distribute_prizes`; manage-employees and institution-detail grids drop the Extras column entirely.
- ✅ **FIX-06** — `can_verify` and `can_distribute_prizes` defaults flipped from `true` to `false` (migration 033). 2-flag default per the DEC-08 fold.
- ✅ **DEC-19 README** — `okujiKobo/supabase/migrations/README.md` records the canonical-tree decision.

**Decisions made during implementation:**
- DEC-18 RLS expansion includes `print_jobs` and `design_assets` (α path from discovery) — institutional artifacts should survive employee turnover.
- `last_edited_by` mechanism: trigger (deviation from prompt's app-layer instruction; justified by discovery).
- Comp ↔ profile sync: trigger.
- can_add_extras UI columns: deleted entirely; the extras-section conditional on the terminal now uses `can_distribute_prizes` (same trust gate).

**Operational follow-up:** apply migrations 033-038 to production in order. After applying, the comp admin UI at `/access/comp-subscriptions` is live for platform admins. Existing institutions appear with `tier = 'pending'` — Nathan classifies them post-migration.

**Successor task between Phase 1 and Phase 2:** **BLD-31 — institutional request form (light v1)**, 1-2 days. Provides the consumer-facing intake mechanism that DEC-02 (manual institution review by Nathan) requires.

### Phase 2 — Institutional capability enforcement

**Goal:** McMenamins is safe to onboard. Different employees see different capabilities. Multi-institution employees can switch.

**Items:** Wire `can_design` (BLD-01 enforcement) into `api/design/create`, `can_view_analytics` (BLD-03) into `api/analytics`, `can_manage_employees` (BLD-02) into `/manage/employees` and `api/employees/lookup` (replacing SEC-01's temporary gate). FIX-02 (rename `emp_auth_self_update`). FIX-03 or BLD-30 (multi-institution switcher). FIX-04 (deterministic admin auto-assign or proper switcher).

**Rationale:** this is when the new flags become real. Without enforcement they are just columns.

**Effort:** ~2-3 weeks.

**Dependencies:** Phase 1.

**Could move:** BLD-30 could be deferred if no beta participant has multi-institution memberships. FIX-03 is the band-aid; BLD-30 is the proper fix. Worth doing both in sequence.

### Phase 3 — Designer access gating

**Goal:** the four paths to publishing (Free trial / Pro private / Studio public / Institution can_design) are enforced. Ambassadors can be comped and start using Studio.

**Items:** BLD-06 (trial limits), BLD-09 (private/invite-only), BLD-10 (public marketplace gate), BLD-24 (Studio badge — small). BLD-22 (premium assets) and BLD-23 (draft library) if wanted.

**Rationale:** this completes the designer-side of the user model. Until this phase, every user can design anything; Appendix L's quality-control story relies on these gates.

**Effort:** ~2-3 weeks.

**Dependencies:** Phase 1 (subscription state, comp table), Phase 2 (capability enforcement for the institution path).

**Could move:** BLD-09 (private codes) could be deferred if early ambassadors only want public publishing. BLD-22 (premium assets) is curatorial work and can land as soon as assets are produced.

### Phase 4 — Subscription billing — *deferred*

**Goal:** real revenue collection for Pro, Studio, Municipal, Business tiers.

**Items:** BLD-25, BLD-26, BLD-27.

**Rationale:** all three require revisiting the deferred Stripe work. Until then, this phase cannot start. Comped subscriptions (BLD-12 in Phase 1) cover ambassadors without billing.

**Effort:** ~4-8 weeks once Stripe block lifts.

**Dependencies:** **deferred Stripe revisit** + Phase 1.

**Could move:** Business-tier custom invoicing could be entirely manual for the first 6-12 months. McMenamins on a hand-cut contract is not unreasonable for v1.

### Phase 5 — Quality and analytics

**Goal:** quality issues are detectable and reviewable at scale.

**Scope change (2026-05-30):** BLD-13 (creator analytics dashboard) and BLD-14 (1-5 star ratings) were pulled forward into the pre-beta critical path — see §5.3 and §5.5 for rationale. They retain the BLD-13 / BLD-14 identifiers; they are no longer Phase 5 items. Phase 5 is now BLD-15 + BLD-28 only.

**Items:** BLD-15 (reactive quality monitoring), BLD-28 (optional pre-publish review).

**Rationale:** neither is required for ambassadors to be productive — Nathan can manually review and engage with the first 10-20 ambassadors. Automated quality monitoring is a scale concern, not a beta concern. With BLD-13 and BLD-14 now landing pre-beta, BLD-15 has its dependencies in place earlier, but the work itself can still wait until the ambassador cohort gives signal on what flagging thresholds are useful.

**Effort:** ~3-4 weeks (was ~4-6 weeks before BLD-13 and BLD-14 moved out).

**Dependencies:** Phase 1 (Studio state), Phase 3 (Studio publishing is happening), BLD-13, BLD-14 (now pre-beta), DEC-05.

**Could move:** BLD-15 and BLD-28 can wait until the ambassador cohort gives signal on what they actually need.

### Phase 6 — Schema cleanup and consolidation

**Goal:** the codebase no longer contains misleading dead paths.

**Items:** CLN-01, CLN-02, CLN-03, CLN-04, CLN-05, CLN-08, CLN-09. FIX-07 (mobile profile screen).

**Scope changes (2026-05-30):**
- CLN-06 narrowed from "consolidate the three migration trees" (1-2 weeks) to a documentation-and-archive task (~1 day) after DEC-19 resolved `okujiKobo/supabase/migrations/` as canonical. The canonical-tree README itself lands in Phase 1's first migration PR; CLN-06 in Phase 6 is the remaining historical-marker work on the mobile and `okuji-db` trees.
- CLN-07 (drop redundant mobile-baseline RLS policies) **largely obsoleted by FIX-01's migration 032** — `redemption_tokens`, `employee_accounts`, and `proprietors` (along with their RLS policies) were dropped in 032. A residual sweep for any remaining mobile-only policies on tables that still exist may be useful but the bulk of the work landed early.
- The dead-component cleanup for `components/employee/PrizeDistribution.tsx` and `TokenScanner.tsx` also landed in FIX-01.

**Rationale:** pure hygiene. No behavioral change.

**Effort:** ~3-5 days (was ~1 week before CLN-06 narrowed and the FIX-01 retirements landed).

**Dependencies:** ~~DEC-01~~ (still open), ~~DEC-16~~ ✅, ~~DEC-17~~ ✅, ~~DEC-19~~ ✅, BLD-02 (the new mechanism CLN-08 retires). Only DEC-01 still blocks any Phase 6 item — specifically CLN-01.

### Phase 7 — Pro consumer features (post-beta)

**Goal:** Pro becomes worth $5/mo for collectors.

**Items:** BLD-16 to BLD-21. Real consumer-product work; substantial. **BLD-29 (Civic self-enrollment) also lives here or beyond** — deferred indefinitely per DEC-02; revisit when institutional volume justifies automated onboarding.

**Rationale:** for the institutional beta and the ambassador program, Pro consumer features are not required. They make Pro attractive when it launches publicly. Defer until the institutional model is stable.

**Effort:** months. Each feature is multi-week.

**Dependencies:** BLD-07, plus the relevant DECs (DEC-11 Heritage partner, DEC-12 Pro split). BLD-29 also depends on DEC-07.

---

## Section 4 — Dependency map

A table is more navigable than a graph for this size.

Cell meaning: row depends on column. ✅ = strict prerequisite; ◐ = soft (can move in parallel but informs).

| Item | Depends on |
|---|---|
| SEC-01 | (optional ◐ BLD-02 for the proper gate; admin-only is fine for Phase 0) |
| SEC-02 | (optional ◐ BLD-02 + BLD-04; admin-only Phase 0) |
| SEC-03 | ✅ closed 2026-05-30 in Phase 1 PR (migration 033 dropped the column; API check removed). |
| SEC-04, SEC-05 | none |
| FIX-01 to FIX-07 | FIX-01 ✅ closed 2026-05-30 (also retired redemption_tokens, employee_accounts, proprietors); FIX-05 ✅ closed; rest unchanged: FIX-02 ◐ ~~DEC-16~~ ✅; FIX-03 ◐ DEC-04; FIX-04 ◐ BLD-30; FIX-06 simplifies post-DEC-08 (2-flag change); FIX-07 unblocked by DEC-17 ✅ |
| BLD-01..04 | ✅ schema shipped 2026-05-30 (migration 033). Enforcement depends on the gating phase. |
| BLD-05 | ✅ shipped 2026-05-30 (migration 034). Nathan sets the column on manual provisioning per DEC-02. |
| BLD-07, BLD-08 | ✅ shipped 2026-05-30 (migration 035). |
| BLD-12 | ✅ shipped 2026-05-30 (migration 036 + admin UI). BLD-07, BLD-08 prerequisites met. |
| BLD-06 | BLD-07, BLD-08, BLD-01, DEC-03, DEC-20 |
| BLD-09 | BLD-07 |
| BLD-10 | BLD-08, BLD-01, BLD-09 |
| BLD-11 | BLD-05, BLD-08 |
| BLD-22 | BLD-08, BLD-05 |
| BLD-23 | DEC-20 |
| BLD-24 | BLD-08 |
| BLD-13 | BLD-08 |
| BLD-14 | none (logically after BLD-13) |
| BLD-15 | BLD-13, BLD-14, DEC-05 |
| BLD-28 | BLD-08 |
| BLD-25 | deferred Stripe, BLD-07, BLD-08 |
| BLD-26 | deferred Stripe, BLD-05, BLD-04 |
| BLD-27 | deferred Stripe, BLD-08 |
| BLD-16..21 | BLD-07 + DECs |
| BLD-29 | BLD-05, DEC-07 — **also: deferred indefinitely per DEC-02 ✅** |
| BLD-30 | DEC-04 |
| **BLD-31** | none. Could land before Phase 1 standalone, but the locked sequence is "after Phase 1, before Phase 2" so the admin UI for institution creation exists when requests arrive. |
| CLN-01 | DEC-01 |
| CLN-04 | none (touches many policy bodies) |
| CLN-06 | ~~DEC-19~~ ✅ — narrows to a documentation task (~1 day). |
| CLN-07 | CLN-06 — unblocked by DEC-19 ✅; largely obsoleted by FIX-01's migration 032 (the bulk of the mobile-baseline policies attached to tables that no longer exist). |
| CLN-08 | ~~DEC-16~~ ✅, BLD-02. |
| CLN-02, CLN-03, CLN-05, CLN-09 | none |

---

## Section 5 — Critical path to beta

The most actionable section.

### 5.1 — What MUST be done before ANY external user

These are non-negotiable for any beta exposure, McMenamins or not:

- ✅ **SEC-01** — closed (`a38093b`, 2026-05-30). Email-enumeration oracle gated.
- ✅ **SEC-04** — closed (`c6a0c5e`, 2026-05-30). Share-render authorization + token entropy.
- ✅ **SEC-05** — closed (`0c2fab4`, 2026-05-30). Storage policy enforces per-user folders. **Migration apply pending — run `031_design_assets_storage_policy.sql` before exposing to external users.**
- ✅ **SEC-06** — closed (`07108d8`, 2026-05-30). SVG inputs escaped.
- ✅ **FIX-01** — closed (`feat/fix-01-mobile-terminal-unification`, 2026-05-30). Mobile terminal on canonical schema; three legacy tables retired; parallel-tables silent break absorbed. **Migration apply pending — run `032_unify_redemption_into_completion_tokens.sql` and redeploy the `generate-token` edge function before exposing to external users.**

All five items in this critical-path row are closed in code. The row is gated on two migration applies + one edge-function redeploy as operational work.

SEC-02 (institution PATCH gate) and SEC-03 (can_add_extras at RLS) can land in Phase 0 or Phase 1 — they are not "external user can exploit from day 1" risks the way SEC-01 was, but they are real and should not slip past Phase 1.

### 5.2 — What MUST be done before McMenamins specifically

McMenamins is Business tier. They need:

- All of 5.1.
- **BLD-05** — institution tier classification (so they are correctly classified as Business).
- **BLD-02** — `can_manage_employees` flag (so the McMenamins admin can add employees with restricted capabilities).
- **BLD-01** — `can_design` flag (so designers within McMenamins are separated from verifiers).
- **BLD-03** — `can_view_analytics` flag (so analytics access is restricted to the right staff).
- **Phase 2 enforcement** — wire those flags into the routes that matter.
- **BLD-11** — custom branding (Business tier capability per L.5). Could be deferred to v1.1 if McMenamins is OK with co-branded for the first month, but it's a flagship Business-tier capability.

Total **incremental** work on top of 5.1: **about 3-4 weeks** (Phases 1 + 2 minus the parts not on McMenamins' critical path).

**Billing for McMenamins:** custom hand-cut contract is fine for v1 beta; BLD-26 (institutional billing automation) is **NOT** on McMenamins' critical path. Stripe Invoices can be operated manually until the deferred Stripe work resumes.

### 5.3 — What MUST be done before the ambassador program

Per L.8, the ambassador program is 10-20 comped Studio subscriptions. Ambassadors need:

- All of 5.1.
- **BLD-08** — Studio subscription state.
- **BLD-12** — `comp_subscriptions` table + admin grant UI (the *enabler*).
- **BLD-10** — public marketplace gate (so publishing actually means something).
- **BLD-09** — invite-only mechanism if any ambassador wants private testing first (optional for launch).
- **BLD-24** — Studio creator badge (so ambassadors are visible to collectors as the curated tier).
- **BLD-22 schema only** — the `tier_required` column on `design_assets` and the picker-side gating. The *curatorial* work in BLD-22 (selecting and uploading the actual premium asset set) stays deferred; the column needs to exist pre-beta so the gate is wired and assets can be tagged later without a schema change.
- **BLD-13** — creator analytics dashboard. Pulled forward from Phase 5: ambassadors using Studio without per-passport analytics produce thin pricing signal. The dashboard is the artifact that lets ambassadors evaluate whether Studio is worth paying for once comps end.
- **BLD-14** — 1-5 star collector ratings. Pulled forward from Phase 5: ratings are the second axis (after acquisitions/completions) by which an ambassador can judge passport quality and the rest of us can judge ambassador quality.

Total **incremental** work on top of 5.1: **about 6-8 weeks** (was 3-4 weeks before BLD-13, BLD-14, and BLD-22 schema were pulled in). Notably, this does NOT require Phase 4 (billing) — comped subscriptions sidestep payment entirely.

### 5.4 — What can be deferred until AFTER beta

- All Phase 4 (Stripe billing) — depends on deferred work anyway.
- BLD-15 (reactive quality monitoring) and BLD-28 (pre-publish review) — the remaining Phase 5 quality-automation items. Manual review of 10-20 ambassadors is tractable.
- All Phase 6 schema cleanup. No behavioral impact.
- All Phase 7 Pro consumer features. Pro doesn't launch as a public consumer tier until after the institutional beta proves the model.
- BLD-22 *curatorial* work (producing the actual premium asset set). The schema lands pre-beta per 5.3; the curated assets can ship a few weeks after ambassador onboarding.
- BLD-29 (Civic onboarding workflow) — not until a Civic-tier institution actually shows up. Beta is McMenamins + ambassadors; no Civic onboarding until after.

### 5.5 — Beta-ready milestone

**Conjoining 5.1, 5.2, and 5.3:** the minimum to onboard McMenamins AND 10-20 ambassadors is:

- Phase 0 complete (~2 weeks).
- Phase 1 complete (~2 weeks; includes the `can_add_extras` retirement, `last_edited_by`/`last_edited_at` columns, and the canonical-tree README per DEC-08/-18/-19 resolutions).
- BLD-31 (institutional request form, ~1-2 days) between Phase 1 and Phase 2.
- Phase 2 complete (~2-3 weeks).
- A trimmed Phase 3: BLD-10, BLD-09 (optional), BLD-24, BLD-22 schema (~2 weeks; BLD-22 schema-only adds ~1 day).
- BLD-13 (creator analytics dashboard, now in critical path): +2-3 weeks.
- BLD-14 (1-5 star ratings, now in critical path): +1-2 weeks.

**Total: about 11-16 working weeks of focused work** (revised from 8-12) for the safest, most defensible beta.

**Why BLD-13, BLD-14, and BLD-22 schema were pulled in:** the ambassador program is the *pricing instrument* — its job is to put Studio in front of 10-20 real creators so we can see whether the value justifies the price before charging anyone. Ambassadors using a Studio that has no analytics dashboard and no rating mechanism produce thin signal. They can tell us anecdotally whether they like Studio, but we cannot answer "do passports made with the curated assets perform measurably better?" or "do top-rated passports cluster on a particular creator?" without BLD-13 and BLD-14. BLD-22's schema column is required for the asset-tier gate to be wired into the picker; without it, the Studio differentiator on the asset library is invisible to ambassadors. Curation can follow.

This assumes the DECs in §6 are resolved in parallel — they're not engineering work but they block engineering work.

---

## Section 6 — Decisions required before implementation

The 20 DEC items from Section 2, restated as a checklist. Each one is a small product question that the engineering work cannot legitimately answer.

### Resolved (2026-05-30)

The six Phase-1-blocking DECs were resolved in the 2026-05-30 product conversation. Resolutions are summarized here; details and downstream impact are in §2 (the DEC table and the affected SEC/FIX/BLD/CLN entries).

- ✅ **DEC-02** — *Institution-tier assignment at sign-up:* **manual review by Nathan in v1.** No public self-service onboarding flow. Nathan personally qualifies each inquiry, agrees on terms (signed contract for paying tiers; lighter acknowledgment for Civic), and provisions the institution through the platform-admin UI. BLD-31 provides the light intake mechanism (Section 2, B.9). BLD-29 (Civic self-enrollment) deferred indefinitely until institutional volume justifies automation.
- ✅ **DEC-08** — *Keep `can_add_extras`, fold, or retire:* **fold into `can_distribute_prizes`.** Anyone trusted to redeem prizes is trusted to add extras (bonus gift-card value). Column retired in Phase 1's first migration. Simplifies SEC-03 (drop the dead API check; existing `can_distribute_prizes` RLS suffices) and FIX-06 (default-flag change becomes 2-flag, not 3).
- ✅ **DEC-16** — *Institutional-manager mechanism:* **replace `institutions.id = auth.uid()` entirely with `can_manage_employees`.** The UID pattern is dead code unreachable through any UI; retired in favor of Appendix L's capability-flag model. Simplifies FIX-02 to cleanup-only (drop the dead UID clause from the policy's USING expression); unblocks CLN-08 (drop dead `emp_auth_manager_*` policies) and the `institutional_manager` branch cleanup in `okujiKobo/lib/roles.ts:76-92`.
- ✅ **DEC-17** — *Remove the legacy mobile `profile.role === 'employee'` check:* **remove.** Rewire to `EmployeeContext` + `is_platform_admin`. FIX-07 stays scheduled for Phase 6 as standalone cleanup, not bundled with FIX-01. Same cleanup motion as CLN-01 at a different layer.
- ✅ **DEC-18** — *Can institutional employees with `can_design` edit institution-owned passports:* **yes, when `proprietor_id IS NOT NULL`.** The institution owns the work product collectively; `can_design` is the trust gate. Personal (non-institutional) passports retain strict `creator_id`-only edit semantics. RLS update on `passports`, `passport_pages`, `stops`, and related tables in Phase 1: OR the existing `creator_id = auth.uid()` clause with an institution-employment + `can_design` clause, gated on `proprietor_id IS NOT NULL`. Schema additions: nullable `last_edited_by` (uuid) and `last_edited_at` (timestamptz) on `passports`, written by application code on save — lightweight audit trail without a full audit-log feature.
- ✅ **DEC-19** — *Canonical migration tree for greenfield deploys:* **`okujiKobo/supabase/migrations/` is canonical.** Mobile `supabase/migrations/` is historical (applied at points in production; no new migrations land there). `okuji-db/supabase/migrations/000_baseline.sql` becomes reference documentation. CLN-06 narrows from a 1-2 week consolidation effort to a ~1 day documentation-and-archive task. A README at the canonical tree records this and lands as part of Phase 1's first migration PR.

### Open (14 remaining)

**Foundational (still resolve before related Phase 1 items, but none block Phase 1 anymore — DEC-01 is Phase 6 only):**

- DEC-01: retire or keep the legacy `profiles.role` values? (blocks CLN-01 only)

**Affecting Phase 2 / 3:**

- DEC-03: trial-limit enforcement at DB or app?
- DEC-04: multi-institution switcher UX shape?
- DEC-20: separate draft-library cap (BLD-23) vs reuse of trial cap?

**Affecting Phase 4 (billing):**

- DEC-09: Studio pricing (pending ambassador data).
- DEC-10: Municipal pricing tiers by city.
- DEC-11: print partner for Heritage Edition discount.
- DEC-12: Pro split into individual vs family.

**Affecting Phase 5:**

- DEC-05: quality-threshold criteria for flag-for-review.

**Affecting Phase 7:**

- DEC-13: loyalty grandfather for existing collectors at Pro launch.

**Affecting policy / external review:**

- DEC-06: religious-institution boundary specifics.
- DEC-07: Civic-onboarding verification mechanism.

**Affecting future scale:**

- DEC-14: suspension / denial mechanism.
- DEC-15: finer-grained admin roles when team grows.

---

## Section 7 — Items explicitly out of scope or deferred

This section restates what is NOT in this roadmap, for the avoidance of doubt later.

### Deferred Stripe work

The user has previously deferred revisiting the Stripe integration. Phase 4 (BLD-25, BLD-26, BLD-27) is therefore **out of scope until that deferral lifts**. The roadmap assumes:

- Comped subscriptions (BLD-12) are the *only* path to Studio access in v1 beta. Ambassadors get gifted access; nothing is sold.
- McMenamins is billed via hand-cut contract; institutional Stripe Invoices automation does not exist in v1.
- The mobile app does not collect payment for paid passports in v1; existing `is_free`/`price_cents` columns are written but not enforced (consistent with the README's note that mobile has no payment SDK).

When the Stripe block lifts, Phase 4 is well-defined and ~4-8 weeks of focused work.

### Pro consumer features

Per §3 Phase 7. Family/groups/timeline/search/tags/Heritage Edition are deferred until the institutional model is in beta and producing signal. Pro itself can exist as a label / state earlier, but its *consumer features* don't land until after.

### Quality-monitoring automation

Per §3 Phase 5. The first 10-20 ambassadors get manual review by Nathan. Threshold-based flag-for-review can come later.

### Civic-onboarding self-enrollment

Per §3 Phase 7. Until a Civic-tier institution actually onboards, this is speculative work. Beta is McMenamins (Business) + 10-20 individual ambassadors (Studio comped). No Civic onboarding needed for v1.

### Finer-grained platform admin roles

Per L.7 — out of scope until there's even one part-time team member or co-founder. Nathan as sole platform admin is the assumed v1 model.

### Schema-tree consolidation timeline

Phase 6 is hygiene. The codebase is not broken without it; it is just confusing. Can land any time after beta, prioritized against other Phase 6 / Phase 7 work.

---

## Section 8 — Cross-references

### 8.1 — Work items to Appendix L sections

| Appendix L section | Work items implementing it |
|---|---|
| L.1 (five user types) | foundational throughout; particularly BLD-07, BLD-08, BLD-05 |
| L.2 (Collector / Free) | BLD-06 (trial limits); no other gating |
| L.3 (Okuji Pro) | BLD-07, BLD-09, BLD-16–21, BLD-25 |
| L.4 (Okuji Studio) | BLD-08, BLD-10, BLD-11, BLD-13, BLD-14, BLD-15, BLD-22, BLD-23, BLD-24, BLD-25, BLD-27, BLD-28 |
| L.5 (Institution / tiers) | BLD-05, BLD-11, BLD-26, BLD-29, BLD-31 |
| L.6 (Capability flags) | BLD-01, BLD-02, BLD-03, BLD-04, FIX-06; CLN-08; SEC-01..03 (enforcement) |
| L.7 (Owner + role combinations) | FIX-03, FIX-04, BLD-30; CLN-04 |
| L.8 (Ambassador comps) | BLD-12 |
| L.9 (Four creator paths) | BLD-01, BLD-06, BLD-09, BLD-10 (the four paths' gates) |
| L.10 (Open questions) | DEC-05, DEC-06, DEC-09, DEC-10, DEC-11, DEC-12, DEC-13, DEC-14, DEC-15 |

### 8.2 — Work items to current-state synthesis (`okujiKobo/docs/user-access-model.md` §6 numbering)

| Synthesis gap # | Work item |
|---|---|
| Gap 1 (api/employees/lookup leak) | SEC-01 ✅ |
| Gap 2 (institutions PATCH gate) | SEC-02 |
| Gap 3 (can_add_extras API-only) | SEC-03 ✅ + DEC-08 ✅ |
| Gap 4 (share/render scope) | SEC-04 ✅ + SEC-06 (XSS follow-up) |
| Gap 5 (storage policy) | SEC-05 ✅ |
| Gap 6 (institutions RLS bug — fixed in migration 026) | none (already fixed) |
| Gap 7 (unreachable role values) | CLN-01 + DEC-01 |
| Gap 8 ('designer' role unreachable) | CLN-02 |
| Gap 9 (manager pattern unreachable) | DEC-16 + CLN-08 |
| Gap 10 (emp_auth_self_update misnamed) | FIX-02 |
| Gap 11 (institutions_admin_read redundant) | CLN-05 |
| Gap 12 (mobile terminal wrong table) | FIX-01 ✅ |
| Gap 13 (Design Certified scaffolding) | CLN-03 (or fold into BLD-24) |
| Gap 14 (three migration trees) | DEC-19 + CLN-06 |
| Gap 15 (mobile/web RLS policies coexist) | CLN-07 |
| Gap 16 (three admin tests) | FIX-05 ✅ + CLN-04 + DEC-17 |
| Gap 17 (inconsistent capability checks) | BLD-01..04 (the missing flags) + Phase 2 (the missing enforcement) |
| Gap 18 (web/mobile employee disagree) | covered by BLD-01..04 enforcement + DEC-17 |
| Gap 19 (no invitation flow) | resolved by SEC-01's replacement design; partial |
| Gap 20 (no promotion flow) | DEC-15 (admin promotion); for tier promotion, BLD-07/08 covers Pro/Studio; institutional employees are added via /manage/employees |
| Gap 21 (multi-institution switching) | FIX-03 + BLD-30 |
| Gap 22 (default flag values) | FIX-06 |
| Gap 23 (non-deterministic admin auto-assign) | FIX-04 |
| Gap 24 (role_label clarity) | CLN-09 |
| Gap 25 (cookie HttpOnly false) | non-issue documented; no work needed |

---

*Document end. Effort estimates assume one focused engineer; not calendar weeks. Estimates exclude code review, deploy windows, and integration time with the deferred Stripe work.*
