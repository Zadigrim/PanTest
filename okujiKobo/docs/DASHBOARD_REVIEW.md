# Operator Dashboard — review report

The post-login dashboard at `/` has been rewritten as an actionable
operator workspace. This document is the companion to the change set
and answers the verification checklist Nathan attached to the build
prompt.

---

## (a) What the v1 dashboard renders

```
┌───────────────────────────────────────────────────────────────────┐
│  Top nav (navy):  okuji  |  My Passports · Assets · Explore ·    │
│                            Stop Library · Access  | avatar       │
├───────────────────────────────────────────────────────────────────┤
│  Welcome back, {first}                                            │
│  {Weekday, Month D} · here's what needs you today                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │  HERO ALERT
│  │ (!) 4 stops are missing coordinates on published passports  │ │  red-tinted; hidden
│  │     Collectors can't GPS-verify these stops until …         │ │  when audit total = 0
│  │                                          [ Review 4 stops →]│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────────┐│  KPI ROW
│  │PUBLISHED │ACQ ·90D  │ACTIVE C. │PRIZES GVN│PENDING DISTRIB. ││  (5 visible; two
│  │    7     │   142    │    89    │    0     │       0          ││   are honest-zero
│  │↑ 2 this  │↑ 18% prr │          │tracking… │ tracking coming  ││   until mechanisms
│  └──────────┴──────────┴──────────┴──────────┴──────────────────┘│   ship)
│                                                                   │
│  ┌─────────────────────────────────┬────────────────────────────┐ │  TWO-COL
│  │ NEEDS ATTENTION                 │ RECENT ACTIVITY            │ │
│  │ · "Forest School" is one step  │ 12:42 ● Stamp · Bloedel    │ │
│  │   from publish · Continue →     │ 11:08 ● Collector joined   │ │
│  │ · You've been offered "Gallery"│ Mar 9  ● Passport published │ │
│  │   · Accept →                    │ …                          │ │
│  │ · 4 stops need location data    │                            │ │
│  │   · Review →                    │                            │ │
│  └─────────────────────────────────┴────────────────────────────┘ │
│                                                                   │
│  JUMP TO                                                          │  JUMP TILES
│  ┌───┬───┬───┬───┬───┬───┐                                         │  6-up legend row;
│  │ M │ P │ A │ E │ S │ X │  Passports/Program/Assets/Explore/      │  gated by role.
│  └───┴───┴───┴───┴───┴───┘  Stop Library/Access                    │  Admin sees all 6.
└───────────────────────────────────────────────────────────────────┘
```

**Hidden-when-clean:** the HeroAlert returns `null` whenever the
coordinate audit sums to zero — no empty card, no placeholder.

**Empty states:** the AttentionQueue renders a quiet one-liner
("Nothing needs you right now."); the ActivityFeed renders "No
activity in the last 90 days." Neither leaves blank space.

---

## (b) The exact query behind each visible number

All queries are batched in **one** `Promise.all` group inside
[`lib/dashboard/load.ts`](../lib/dashboard/load.ts). Scope key:

> **Owned passports** = `creator_id = user.id` **OR**
> `proprietor_id IN (institutions the user manages)`. After ownership
> transfer the creator_id is a custodial account, so the
> proprietor_id branch is the durable institutional link.

| KPI | Query |
|---|---|
| **Published** | `count(owned where is_published = true)` (from the keystone owned-passports query, no extra round-trip) |
| Published delta (`↑ N this mo`) | Same set, filtered to `published_at >= monthStart` |
| **Acquired · 90d** | `from('acquisitions').select('user_id, acquired_at').in('passport_id', ownedIds).gte('acquired_at', ninetyAgo)` — rows count |
| Acquired delta (`↑ N% vs prior 90d`) | `from('acquisitions').select('id').in('passport_id', ownedIds).gte('acquired_at', oneEightyAgo).lt('acquired_at', ninetyAgo)` |
| **Active collectors** | distinct `user_id` from the Acquired·90d result (free reuse, no second query) |

| Attention item | Query / source |
|---|---|
| Near-publish drafts | `runPublishChecklist()` over each draft, fed by one batch each of `passport_pages` + `stops` (joined via `passport_pages!inner(passport_id)`) for the draft ids. Surfaces those with **≤ 2** blockers, sorted closest-to-done first, capped at 5. |
| Incoming transfer offers | `from('passport_transfers').select(...).eq('status', 'pending')` then filtered in app: `initiated_by !== user.id AND (to_user_id === user.id OR to_institution_id IN myInstitutions)`. Passport titles fetched in one follow-up batch. |
| Outgoing pending transfers | `.eq('initiated_by', user.id).eq('status', 'pending')` (separate small query — different filter). Titles fetched in one batch. |
| Coordinate-audit summary row | Derived from the audit numbers below (no extra query). |

| Audit | Query |
|---|---|
| GPS / QR missing | `from('passport_pages').select('id, passport_id').in('passport_id', publishedIds)` then `from('stops')...in('page_id', pageIds)`, filtered in app via `stopLocationIssue()` (the same helper PublishFlow uses). |

| Activity feed | Query |
|---|---|
| `Collector joined` (acquire) | `from('acquisitions').in('passport_id', ownedIds).order('acquired_at desc').limit(8)` |
| Stamp events | `from('stamps').in('passport_id', ownedIds).order('verified_at desc').limit(8)` + a single `stops` lookup to fetch names |
| `Passport published` | Derived in-memory from the owned-passports `published_at` column (no extra round-trip) |

Sub-totals: roughly **9** parallel queries in the main fan-out plus
**2–3** small follow-up name lookups (only when there's data to
title). For an account with no passports, the loader short-circuits
to `Promise.resolve({ data: [] })` for every owned-scope query.

---

## (c) Coordinate audit round-trip

1. Create a passport, add one GPS-method stop, leave lat/lng null,
   publish it.
2. Reload `/` — the hero alert reads
   _"1 stop is missing coordinates on published passports"_ and the
   AttentionQueue carries a matching `audit-summary` row pointing at
   `/dashboard/audit`.
3. Click **Review 1 stop →** — the audit page lists the stop with the
   passport · page · stop trail and a "Fix in designer →" deep link
   to `/design/{passportId}`.
4. Open that link, fill in lat + lng via the map picker, save.
5. Reload `/` — the HeroAlert disappears (returns `null`), the
   summary row is gone, the queue trims back to other items.

The validator used by all three surfaces is the same exported
`stopLocationIssue(stop)` — banner, list, and PublishFlow can never
disagree about whether a stop is blocked. See
[`lib/design/publish-checklist.ts`](../lib/design/publish-checklist.ts).

---

## (d) Dormant slots — inventory

All hidden in production. Flip via `NEXT_PUBLIC_DASHBOARD_FLAG_*=1` to
preview locally without a code change.

| Flag | What it gates | Activation TODO |
|---|---|---|
| `showSoldKpi` | The **card** itself (hidden in v1) | Activate when paid acquisitions are first-class. The data already exists (`acquisitions.price_paid_cents` + `stripe_payment_intent_id`); the loader just needs a `where price_paid_cents > 0 OR stripe_payment_intent_id IS NOT NULL` filter. **Activation effort: ~10 lines + a delta calc.** See review item 1. |
| `showPrizesKpi` | The **data hook** (card is always visible — honest zero in v1) | Needs a `prize_redemptions` (or equivalent) source separating "given" from "redeemed." Today `prize_distributed` is a boolean flag on `completion_tokens` recording staff delivery — not collector redemption. Activation = implement the query in `buildPrizesGivenKpi()` in load.ts; the card UI doesn't change. **Activation effort: a small migration + admin path to record redemption events.** |
| `showPendingDistributionKpi` | The **data hook** (card always visible — honest zero in v1) + the accent "needs-action" border (separately gated on `value > 0`). | The COUNT itself is queryable today (completion_tokens where distribution_pending=true AND prize_distributed=false), but the resolving surface — the employee distribution terminal — doesn't exist. Showing the count without the action would be misleading, so the card stays honest-zero until that surface ships. The /program page is the v1 host the terminal extends. **Activation effort: medium (employee-facing terminal + atomic "mark distributed" path).** |
| `showRoleSwitcherPills` | (header — currently rendered via the existing `RoleSwitcher` for multi-role users; the dormant flag is for a richer pill row in the dashboard header itself) | Needs a real "viewing as" mechanism (today, multi-role users get a small switcher in `AppNav`; a header-level pill row would require explicit context override per page render). **Activation effort: low if it just wraps the existing cookie, larger if it gains permission semantics.** |
| `showPrizeActivity` | `ActivityFeed` event types | Needs the prize-given / gift-card-added mechanisms above. **Activation effort: piggy-backs on whichever mechanism lands first.** |

Stub locations:
- The SOLD KPI card stub lives in [`app/page.tsx`](../app/page.tsx)
  (flag-gated render) — the loader doesn't compute a value yet.
- PRIZES GIVEN + PENDING DISTRIBUTION are emitted by the loader's
  `buildPrizesGivenKpi()` / `buildPendingDistributionKpi()` helpers
  in [`lib/dashboard/load.ts`](../lib/dashboard/load.ts). They
  currently return `{ value: 0, delta: 'tracking coming soon' }`
  unconditionally. The TODO at each helper names the source it
  awaits.

**Hard rule:** the two forward-looking cards NEVER display
illustrative or sample numbers in a deployed environment. Local
preview = no flag effect today (the queries don't exist); when a
query is implemented inside one of those helpers, the matching
flag is the on-off switch and the card flips to live data with no
UI change.

---

## (e) Judgment calls flagged for review

### 1. SOLD vs ACQUIRED — payments actually exist

The build prompt said "Sold" should be dormant "because no payment
system exists." That's not quite right: `acquisitions` already carries
`price_paid_cents` and `stripe_payment_intent_id`, and there are
`/api/checkout` + `/api/webhook/stripe` routes. We could light up
SOLD today with a single `where price_paid_cents > 0` filter.

**Recommendation:** keep SOLD dormant for v1 anyway, because (i) it's
unclear whether priced-but-still-zero rows should count as sold or
acquired, and (ii) the "vs acquired" delta is more useful than raw
sold counts in early data. Flip the flag once you have ≥10 paid
acquisitions to validate the framing.

**Decision:** APPROVED — SOLD stays dormant. Acquired and sold remain
distinct concepts; flip the flag at ~10 real paid acquisitions.

### 2. "Paused" program / Resume

Concept: a paused state per passport, surfaceable in NeedsAttention.

**Reality:** `passports.status` is an open enum that's only ever held
`draft | published | archived` in practice. There's no DB CHECK
constraint and no UI to set "paused."

**Recommendation:** **drop the paused concept.** Three reasons:
1. `archived` already covers "stop showing this in Explore" — that
   IS pause, semantically.
2. A third bucket adds vocabulary tax (what's the difference between
   draft → paused → archived?) without solving a problem any current
   creator has reported.
3. If you later want a "temporarily hide but keep collectors active"
   variant, do it as a `published + visible = false` toggle on the
   passport, not a new status — it sidesteps RLS rework.

**Decision:** APPROVED — the paused status is dropped permanently.
`draft | published | archived` is the complete vocabulary, and any
future "hide but keep collectors active" need is a `visible = false`
toggle, never a new status.

### 3. Access requests awaiting approval

Concept: a NeedsAttention row for institutional managers reviewing
employee-access requests.

**Reality:** there is no request flow. Access is admin-granted via
`/access` and the `employee_authorizations` table is populated by the
manager directly.

**Recommendation:** **drop the concept for v1.** A request flow makes
sense for self-service B2B sign-ups, but the okuji institutional
model is curated — the manager onboards employees they already know.
Adding requests would invent a problem. If you later launch
self-service sign-up for institutions, add a `pending_employee_requests`
table at that time and the dashboard slot is a 10-line add.

**Decision:** APPROVED — no access-request queue in v1. Explicitly
retained as a future option if self-service institutional sign-up ever
launches (`pending_employee_requests` table + the 10-line dashboard
slot).

### 4. Active collectors growth delta

We compute `active collectors = distinct user_id from acquisitions in
the last 90d`. The prompt asked for a growth % "if cheap, else omit."
Computing it requires a second `distinct user_id` pass over the prior
90-day window — not free.

**Recommendation:** omit the delta (current behaviour). If the metric
is important, derive a materialized view later instead of doing two
distincts per page-load.

**Decision:** APPROVED — omit the active-collectors delta.
Materialized view later if the metric proves important.

### 5. Activity feed — collector identity

We render "Collector joined" and "Stamp · {stop} · {passport}"
without naming the collector. The existing app surfaces no collector
names anywhere (mood ratings are anonymous, leaderboards don't exist
yet), so this matches the privacy posture.

**Recommendation:** keep as-is. If a future collector-leaderboard or
public profile lands, the feed can show display_name + avatar then.

**Decision:** APPROVED — the activity feed stays anonymous, consistent
with the app-wide privacy posture.

---

## (f) Reuse + payload — confirmation

- The publish-checklist validator is extracted to
  [`lib/design/publish-checklist.ts`](../lib/design/publish-checklist.ts)
  and consumed by:
  - `components/design/PublishFlow.tsx` (the editor)
  - `lib/dashboard/load.ts` (the near-publish queue)
  - `app/dashboard/audit/page.tsx` (the review list)
- One batched call: `loadDashboard()` runs the full fan-out and is
  consumed by both the server page (`app/page.tsx`, direct SSR) and
  the JSON endpoint (`app/api/dashboard/route.ts`). The browser
  never makes a "dozen client round-trips."
- No new event-log / notification framework. Publish events derive
  from `passports.published_at`; stamps from `stamps.verified_at`;
  acquisitions from `acquisitions.acquired_at`.
- Nav: "Program" removed; "Stop Library" already correctly labelled;
  Access remains the conditional sixth item for managers/employees.

---

## Routing structure

| Route | Purpose | Type |
|---|---|---|
| `/` | Operator dashboard (this redesign) | Server component |
| `/api/dashboard` | Batched JSON for client refresh | API route |
| `/dashboard/audit` | Coordinate-audit review list | Server component |
| `/design` | My Passports (the table from the prior change set) | Server component |
| `/program` | v1 Program overview — prize text + collector counts per passport | Server component |
| (unchanged) `/transfers`, `/assets`, `/explore`, `/stops`, `/access`, `/design/[id]`, `/design/new` | | |

### JumpTiles — role gating

| Tile | Allow list | Notes |
|---|---|---|
| My Passports | individual_creator, institutional_manager, designer, institutional_employee | Everyone except platform_admin (admin bypass below) |
| Program | individual_creator, institutional_manager | The two roles with prize-ownership semantics |
| Assets | individual_creator, institutional_manager, designer, institutional_employee | Library-wide upload + reuse |
| Explore | individual_creator, institutional_manager, designer, institutional_employee | Public-passport browse |
| Stop Library | individual_creator, institutional_manager, designer, institutional_employee | Shared educational stops |
| Access | institutional_manager, institutional_employee | Mirrors AppNav's `canAccessManagement` audience |

**Platform-admin bypass:** when `roles` includes `platform_admin` the
allow list is skipped entirely — every tile renders enabled. This
matches the prompt requirement ("Platform admin NEVER sees a
disabled tile"). Disabled tiles render with `opacity-50`, an
`aria-disabled` attribute, and a small "No access" sub-line.

The dashboard remains the post-login landing — no new redirect or
route group needed.
