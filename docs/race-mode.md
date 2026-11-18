# Race mode

Status: **concept / planning.** Nothing in this doc is built. It
records the working model so later prompts can start from it.
Schema notes at the bottom are proposals, not migrations.

## What it is

Race mode turns a passport into a team competition, like the
challenge race shows on TV, but for anyone. Friends, families,
coworkers, or a whole town can form teams and race a course. Every
stamp is GPS-verified and timestamped by the server, so results are
clean and hard to fake.

Do not use any TV show's name or terms in product copy. Element
names below are working names.

## Where it fits in the passport type model

Passport types are built from these axes:

**Scope × Theme × Size × Players × Mechanic × Time window × Payoff**

- Scope: how much ground (city, state, region, oddities, road trip).
- Theme: what it is about (food, lighthouses, ghost towns).
- Size: how much commitment (weekend trip through lifelong
  adventure).
- Players: who collects (solo, team, duel, community).
- Mechanic: how stamps are earned (open, sequence, clue reveal,
  bingo, streak).
- Time window: when it is open (season, event day, race start).
- Payoff: what finishing gets you (badge, sticker, donation, prize).

Race mode is the Players axis set to team or duel, combined with
race mechanics and a time window. Verification method (GPS, QR,
witnessed, documented) is a per-stop property, not an axis.

## Race elements

| Element          | How it works                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| Clue reveal      | The next stop is hidden until the team stamps the current one. Builds on the sequence rule. |
| Solo challenge   | Only one team member's stamp counts at this stop. Each member must take at least one before the finish. |
| Fork             | The team picks one of two stops. Either stamp unlocks the next leg. Example: near and hard vs far and easy. |
| Checkpoint       | Every team member must stamp within N minutes of each other. Proves the team arrived together. |
| Shortcut         | One hidden stop per race that lets a team skip a leg.                        |
| Finish           | First team to stamp the final stop wins. Server time decides order.         |

## Formats

1. **Hosted race.** A creator sets up the race with registered
   teams and a fixed start time. Use cases: corporate team building,
   school events, bachelor and bachelorette parties, chamber of
   commerce event days, tourism board promotions.
2. **Open challenge.** Anyone forms a team and runs the course
   whenever they want. Fastest times go on a seasonal leaderboard.
3. **Duel.** Two teams challenge each other on the same course.
   Families and friend groups.

## Rules from CLAUDE.md that shape the design

- **Invariant 2, one stamp per collector per stop.** Team progress is
  an aggregate of member stamps. Nothing about the stamps constraint
  changes.
- **Invariant 7, aggregate only.** Leaderboards show team names,
  times, and counts. No individual collector identity on creator or
  operator surfaces. Team names are chosen by the team and are opt-in.
- **Invariant 8, no parallel acquisition table.** Each member still
  acquires the passport through `collector_passports`. A team is a
  grouping over those records, not a new acquisition type.
- **Invariant 6, honest data.** Race times and standings come from
  real stamp timestamps. No projected or placeholder standings.
- **Mobile freeze.** Rule enforcement (sequence, clue reveal, forks,
  checkpoints) should live in `verify-stamp` so it ships without a
  new binary. Team setup and a live leaderboard need new UI. A web
  page can cover those first; in-app screens wait for a new build.

## Dependencies

- **Stop rules (time window + sequence).** Clue reveal and forks are
  sequence rules. See the stop rules Phase 0 prompt. This lands
  first.
- **Rejection messages.** Collectors need to see why a stamp was
  refused ("Finish the current leg first"). Depends on whether the
  mobile app displays server message text, which the stop rules
  Phase 0 answers.
- **Hidden stops.** Clue reveal needs a way to hide a stop's name and
  location until it unlocks. The current app may show all stops on
  the page. Needs investigation.

## Business angle

Hosted races are easy to sell:
- Tourism boards and downtown associations (race day events).
- Corporate team-building companies.
- Fundraisers, where team entry fees go to a charity. Ties into
  `docs/charity-passports.md`.

## Open questions

- Team size limits? Minimum and maximum members.
- Does a team share one passport view, or does each member see their
  own with team progress overlaid?
- How does a team handle a member who drops out mid-race?
- Is the start a group start at a set time, or a staggered start
  with each team's clock starting at its first stamp?
- Penalties or time bonuses? Keep it simple at first.
- Can a race be re-run as a new edition each year, with past results
  kept?
- Anti-cheating: GPS spoofing is the main risk. Checkpoints help.
  What else?
- Hosted race pricing: per team, per event, or a flat creator fee?

## Schema notes (proposal only)

Not for building yet. Captured so a later Phase 0 report has a
starting point.

- `teams`: id, passport id, name, created at, optional invite code.
- `team_members`: team id, collector passport id, joined at. A
  member points at their existing `collector_passports` row.
- Race settings on the passport: race format (hosted, open, duel),
  start time, team size limits.
- Per-stop race fields: fork group id, solo challenge flag,
  checkpoint window minutes, hidden-until-unlocked flag.
- Standings and finish times computed from `stamps` timestamps.
  Derived, never stored as hand-entered numbers.
