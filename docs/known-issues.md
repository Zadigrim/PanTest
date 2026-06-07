# Known Issues register

Canonical in-repo register for known issues. Anything tracked
elsewhere (e.g. a delivered docx) is a copy of this file's
contents, not a separate source of truth — this file wins on
disagreement.

**Entry format:**
- **Status** — OPEN / CLOSED. CLOSED entries are kept here for
  history; new related work appends a new entry rather than
  re-opening.
- **What it is** — one-line definition.
- **User-facing risk** — what a real user would experience or
  what an attacker could do.
- **Why deferred** (if OPEN) — what's blocking, or the explicit
  trade-off.
- **To resolve** (if OPEN) — what closes the entry.

The lesson from KI-01: state what currently EXISTS plainly. Do
not describe surfaces or behaviors that aren't built. "Pending
Nathan in-app verification" on a CLOSED entry is honest about
build-verified ≠ Nathan-verified per CLAUDE.md.

---

## KI-03 — CLOSED — Capability flags enforced server-side

**Closed:** commit `98e47fd` (KI-03 Phase 2 build).

**What it was:** the four institutional capability flags
(`can_design`, `can_manage_employees`, `can_view_analytics`,
`can_manage_billing`) on `employee_authorizations` were settable
via the EmployeesPanel but inert — no route, no RLS policy
consulted them. An employee with `can_design = false` could still
edit institution-owned content via direct table writes.

**What now exists:**
- `lib/roles/require-flag.ts` — single helper `callerHasFlag` +
  `authorizePassportMutation`. Single mechanism per CLAUDE.md
  invariant #4: `is_platform_admin` is the only admin gate.
- `can_design` enforced in: `/api/passports/[id]` (DELETE),
  `/api/passports/[id]/unpublish` (POST),
  `/api/passports/[id]/republish` (POST),
  `supabase/functions/provision-qr-token` (edge). Plus the
  existing migration-038 RLS on passports / pages / stops /
  passport_autosaves / print_jobs / design_assets.
- `can_manage_employees` enforced in `/api/employees/lookup` +
  passport_transfers RLS (migration 051).
- `can_view_analytics` enforced inside `lib/program/load.ts` —
  institutions where the caller lacks the flag are filtered out
  of the analytics scope.
- `can_manage_billing` enforced in `/api/institutions/[id]`
  PATCH for billing-axis fields.

**Pending Nathan in-app verification.** Build-verified via
`tsc --noEmit` clean on touched files; functional behavior
across the four denial paths + four allowed paths needs
Nathan's live click-through.

---

## KI-04 — CLOSED — Studio publish gate

**Closed:** shipped and Nathan-verified.

**What it was:** marketplace publish required a Studio tier
gate. Implemented in `lib/design/publish-checklist.ts` (the
`needsStudio` blocker) consumed by `PublishFlow.tsx`.

---

## KI-07 — OPEN (reduced severity, shipped surface limited) — UGC moderation on Stop Library comments

**What it is:** before this commit, the only moderation tool
on `stop_comments` was admin-DELETE (migration 060). No way for
users to flag a comment; no soft-hide; no signal to admins that
a comment was problematic without proactively re-reading the
list.

**What now exists** (this commit, migration 068):
- Schema: `stop_comments.hidden_at`, `hidden_by`, `reported_at`.
- RLS: non-admin readers don't see hidden comments. The author
  of a hidden comment sees their own row marked-hidden inline.
  Platform admin sees everything.
- Report: any signed-in user can report a comment via
  `POST /api/stops/comments/:id/report`. One report sets
  `reported_at`; repeats are no-ops. No counting.
- Hide / unhide: admin-only via
  `POST /api/stops/comments/:id/hide` (`{ hidden: boolean }`).
  Backed by the SECURITY DEFINER `set_stop_comment_hidden(uuid,
  bool)` RPC; the admin check lives in PL/pgSQL.
- Admin-only "Reported" indicator on reported-but-not-hidden
  comments in the Stop Library.

**Explicitly NOT built** (over-claiming is the KI-01 lesson):
- No automated review.
- No moderation queue surface.
- No counting / threshold logic.
- No notifications.

**User-facing risk that remains:** an admin must manually scan
the Stop Library to find reported comments. With current
volume (zero users) this is fine; at scale a dedicated queue
surface becomes worth building.

**Why this stays OPEN at reduced severity:** the spec calls
the queue "future work when real volume exists." When that's
decided, the entry closes with a new queue migration + UI; the
report + hide mechanism is the foundation, not the whole.

**To resolve fully:** build the moderation queue when the
volume threshold for it is decided.

---

## KI-08 — OPEN (path (a) shipped, path (b) deferred) — Server-side center-within enforcement (stamps)

**What it is:** the rule "a stamp's center must fall inside its
location element's region" is enforced client-side only, in the
mobile `lib/stamp.ts:38-45` (`computeStampPlacement`). The
server-side `verify-stamp` edge function receives no page
geometry and cannot verify the rule. A tampered client could
INSERT a stamp row at any `stamp_pos_x` / `stamp_pos_y`
position; nothing on the server refuses it.

**Two fix paths:**

**(a) Database-level domain enforcement — SHIPPED in this
commit.** Migration 013 (`supabase/migrations/`) adds CHECK
constraints `stamps_pos_x_range` and `stamps_pos_y_range`
restricting both columns to NULL or 0..100. A tampered client
trying `stamp_pos_x = 150` is rejected at the database. The
constraint matches the legitimate client's percentage
semantics from `lib/stamp.ts:47-48` exactly; legacy NULLs
tolerated.

**(a) does NOT verify** the position falls within the SPECIFIC
location element on the page — only that it falls within the
0..100 percentage domain. A tampered client can still place a
stamp at `(50, 50)` of a box it ignored the bounds of.

**(b) Routing the stamps INSERT through verify-stamp with a
placement payload — DEFERRED.** Requires:
- Adding `stops.box_x / box_y / box_width / box_height` to the
  verify-stamp request body.
- Enforcing the rule in the edge function before returning
  `verified: true`, OR moving the stamps INSERT into the edge
  function itself.
- A new mobile binary build to ship the client side of the
  change.

**Why (b) is deferred:** new mobile build. The Play submission
freeze (now narrowed — see CLAUDE.md) still blocks
binary-affecting changes until approval. (b) requires touching
the mobile stamping flow, which means a new build.

**To resolve fully:** ship (b) when a new mobile build is
permitted.

**Source:** patent-investigation report, divergence #3
("Center-within is client-only").
