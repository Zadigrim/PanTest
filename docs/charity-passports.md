# Charity passports

Status: **concept / planning.** Nothing in this doc is built. It
records the working model so later prompts can start from it.
Schema notes at the bottom are proposals, not migrations.

## What it is

A charity passport is a normal okuji passport where local vendors
pledge money to a benefiting organization for each verified stamp
collected at their stop. Collectors explore a town, and every stop
they stamp raises money.

GPS verification is what makes this work. Every stamp is a real,
verified visit, so the vendor gets proof of foot traffic and the
charity gets an auditable total. No self-reported numbers.

## Who does what

The benefiting organization hosts the passport. okuji provides the
tools. okuji does not recruit vendors city by city; that does not
scale, and the charity already has the relationships.

| Party        | Role                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Charity      | Creator account. Builds the passport in okujiKobo, recruits vendors (often existing supporters), promotes to its members, receives the money. |
| Vendors      | Each one is a stop. Signs a pledge before launch. Gets verified visits and goodwill. |
| Collectors   | Collect stamps. Optionally pay for the passport if the campaign uses participant pricing. |
| okuji        | Platform, GPS verification, live campaign dashboard, end-of-campaign stamp report. Charges a platform fee. |

Variant: a chamber of commerce or business district hosts the
passport and names a charity as beneficiary. Same model, different
organizer.

## Money models

1. **Capped per-stamp pledge (recommended default).**
   "Every stamp at this stop donates $1, up to $500." Vendor
   commits up front. Most exciting for collectors because each stop
   visibly adds to the total.
2. **Flat sponsorship.** Vendor pays a fixed amount to be a stop.
   Simplest to settle, less motivating for collectors.
3. **Participant pays.** Collectors buy the passport and a share
   goes to the charity. Can combine with either vendor model.

### Billing

- Do not bill vendors after the campaign as the primary path. It
  invites sticker shock, slow payment, and vendors backing out.
- Preferred: vendor pays its cap up front, or signs a pledge with a
  cap before launch. If stamps do not use the full cap, the
  remainder goes to the charity as a straight donation.
- The okuji stamp report is the settlement document. It shows
  verified stamp counts per stop for the campaign window.

### Keep okuji out of the money flow

Vendors pay the charity directly. okuji bills only its own platform
fee. Holding or passing through charitable funds adds accounting
burden and may trigger state charitable-solicitation rules
(commercial co-venturer and commercial fundraiser registration
vary by state). **Get legal review before the first charity
campaign launches.**

## Limits and editions

- **Limit the time window, not the number of collectors.** Turning
  away people who want to help a charity looks bad. The per-vendor
  cap already prevents runaway bills.
- Campaigns run on a fixed window (for example 6 weeks) using the
  existing passport `effective_at` / `expires_at` window.
- A fixed window gives urgency (like a fun run or walkathon) and a
  clean end-of-campaign total.
- Charity passports follow the existing yearly edition model. Each
  year is a new edition with its own stamp art. Holders of an older
  edition keep it, per the standing edition rules.
- Collectibility comes from edition art that never returns, not
  from quantity caps. Numbered copies are an option only for paid
  physical passports.
- Food vendor stops are already limited to a one-year passport, so
  a yearly charity edition fits that rule naturally.

## Reporting rules

These follow the governing invariants in `CLAUDE.md`.

- **Aggregate only** (invariant 7). Vendors and the charity see
  stamp counts per stop, totals, and timestamps. Never which
  collectors stamped.
- **Honest data** (invariant 6). Pledged, earned, and capped
  amounts all trace to real stamp counts and real pledge records.
  No projected or illustrative totals on any live surface.
- Earned amount per stop = min(verified stamps in window ×
  per-stamp amount, cap).

## Pitch lines

Plain versions for outreach. One link, one ask.

- Vendor: "Verified new customers through your door, your name on a
  good cause, and a hard cap on what you spend."
- Charity: "A fundraiser that runs itself, with a live dashboard."
- Collector: "Explore your town. Every stop donates."

## Open questions

- Platform fee shape: flat per campaign, percentage of pledges, or
  free for the civic tier?
- Does the charity need a verified nonprofit status check before it
  can create a charity passport?
- Should collectors see a live running total on the passport, or
  only at the end?
- Is there a completion bonus (for example, a sponsor matches
  everyone who completes the passport)?
- Pledge agreement template: who drafts it, and does okuji provide
  one in okujiKobo?
- Which state rules apply for the first launch area (Washington)?

## Schema notes (proposal only)

Not for building yet. Captured so a later Phase 0 report has a
starting point.

- A passport-level flag or type marking it as a charity campaign,
  plus a beneficiary name.
- A per-stop pledge record: stop, per-stamp amount, cap, flat
  amount, pledge signed timestamp, paid timestamp.
- Earned totals computed from `stamps` within the passport window.
  Derived, never stored as a hand-entered number.
- Any new tables must respect invariant 2 (one stamp per collector
  per stop) and invariant 8 (no parallel acquisition table).
