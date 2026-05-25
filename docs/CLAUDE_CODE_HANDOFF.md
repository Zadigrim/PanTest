# Okuji — implementation brief for Claude Code

This brief covers two surfaces inside **okujiKobo** (the internal/operator
side of the product):

1. **Designer (v1)** — desktop app that lets passport designers (e.g. a Brooklyn
   restaurant association) create, edit, and publish a passport.
2. **Employee Terminal** — counter-side app for venue employees to redeem stamps
   and distribute prizes, with a required two-step audit flow.

It also asks you to add a **dashboard entry point + navigation** so the
Employee Terminal is reachable from the existing app.

The companion file `wireframes.html` (in the project root) shows the exact
visual direction. Open it and switch between the **Connect · Designer (v1)**
and **Connect · Employee** tabs to see what we're building.

---

## Global rules (apply everywhere)

- **Typography:** sans-serif only. The wireframes use **Inter**; on native, use
  the System font. No serifs anywhere — we removed them deliberately.
- **Color tokens** (already in use across the codebase — keep them):
  - `--ink: #1f1d1a` (primary text)
  - `--paper: #f6f1e6` (warm off-white surface)
  - `--cream: #f5f0e8` (alt surface, for dark backgrounds)
  - `--muted: #6b6356` (secondary text)
  - `--hairline: #c8bfa9` (dividers, dashed borders)
  - `--accent: #c9a84c` (passport gold — primary brand)
  - `--green: #1d9e75` (success / "given")
  - `--red: #9b2335` (danger / refused)
  - `--blue: #2d5a8e` (info)
  - `--navy: #0d1b2a` (dark surface, headers)
- **Density:** desktop screens are roomy; mobile/tablet kiosks are oversized.
- **Don't introduce filler content.** Every section in the wireframes is there
  on purpose; everything not shown is intentionally absent.

---

## 1) Employee Terminal — first because it's smaller

The terminal is a two-step **audited redemption flow**. Step 2 is required and
cannot be dismissed without an outcome being recorded. This is the entire
point — it's what makes the system trustworthy for venue owners.

### 1a. Add a dashboard entry point

The Employee Terminal currently has no surfaced way in. Add it.

- On the **main authenticated dashboard** (the first screen after login for
  users with the `employee` role), add a card titled **"Employee Terminal"**.
  - Title: `Employee Terminal`
  - Subtitle: `Scan & redeem stamps`
  - Icon/emblem: a stamp glyph or a QR icon, framed in a circle with
    `--accent` background.
  - Tap target: navigates to `/employee` (Counter layout, see 1c).
- If a user has multiple roles (e.g. designer + employee), show both cards.
- If a user has only one role, the card is still useful — but auto-navigate to
  the appropriate workspace if you can do so cleanly.

### 1b. Navigation

- Add a **persistent left rail** (or top tab on narrow screens) inside the
  Employee Terminal with these items:
  - **Scan** (default) — `/employee`
  - **Recent** — `/employee/recent` (the list currently shown in the rail can
    expand into a full screen)
  - **Help** — `/employee/help` (placeholder is fine)
- Add a **back-to-dashboard** affordance at the top of the rail (a small
  "Connect" mark + the venue name, both clickable).

### 1c. The redemption flow (Counter layout — the recommended one)

Open the wireframes and read **Connect · Employee → Variation 02 (Counter)**.
That's the layout to build. It has two sections:

**Left rail (persistent, ~280–320px):**
- Venue name + operator name (signed in as)
- Today's counters: `scans / given / pending` (3 numbers, big)
- "Recent" list — last ~6 redemptions with token, prize, time, and a colored
  dot for status (`given` = green, `pending` = gold)
- "Help: tap ?" pinned at bottom

**Right pane (workspace, swaps between two states):**

**State 1 — Scan (`stage = 'scan'`)**
- Heading: `STEP 1 OF 2` (small caps, muted) + `Scan or enter token` (large)
- Two-column body:
  - **Left:** camera viewfinder, square aspect, dark background, four corner
    brackets in `--accent`, scanline animation. Label above: `FROM CAMERA`.
  - **Right:** big monospace token input (placeholder `BX-7H4K`),
    letter-spacing 6, format hint `format MCM-XXXX-XX` below. Label above:
    `OR TYPE`. Below the input, a primary button `Look up token →` (dark ink
    background, cream text).
- Submitting either path advances to State 2.

**State 2 — Redeem (`stage = 'redeem'`)**
- Heading: `STEP 2 OF 2 · REQUIRED` (small caps, muted) + the prize name as a
  large heading (e.g. `Free dessert`).
- Subline: passport name · section · token · customer.
- A **dismissible-prevented** banner (or just the headline) makes it clear the
  step cannot be skipped.
- **Three outcome buttons**, full-width-ish, vertically stacked:
  - `✓ Given` — solid `--green`, white text, primary weight
  - `⏱ Pending — they'll come back` — outlined `--muted`
  - `✕ Refused / unavailable` — outlined `--red`, red text
- **Optional gift card section** (dashed-border card below the outcomes):
  - Label: `Extra gift card (optional)`
  - Amount chips: `$5 / $10 / $15 / $25`. Selecting one fills it dark; others
    are outlined.
- Footer note (italic, muted): `⚠ This step is required — back button is
  disabled`. Implement this — block the back gesture / browser back until an
  outcome is chosen.

After an outcome is recorded, return to State 1 with a brief toast and the
left-rail counters incremented.

### 1d. Experience-verify path (no QR)

For stops that don't have a QR (a rest stop, a viewpoint, a class), expose
**Experience verify** as a separate route under the Employee Terminal:

- Same two-pane layout.
- Right pane shows the customer's stop card + a "Mark as completed" primary
  action.
- Banner if completing this stamp finishes a section ("Section prize will
  unlock").
- Left rail can show a queue of waiting customers when relevant.

### 1e. Source files affected

- New route: `app/employee/_layout.tsx` (rail), `app/employee/index.tsx`
  (scan), `app/employee/redeem.tsx` (or a single component that swaps state),
  `app/employee/recent.tsx`, `app/employee/verify.tsx`.
- Update the **dashboard / role landing page** to include the Employee
  Terminal card.
- Use the existing `ExperienceVerifier.tsx` and `PrizeDistribution.tsx`
  components as the building blocks; restructure their containers to fit the
  Counter two-pane layout.

---

## 2) Designer (v1) — the bigger surface

The Designer is the desktop tool a passport author uses to compose a passport.
The v1 we're building is the **Workspace** variation — a desktop split-pane
CMS-style editor. Open the wireframes and read
**Connect · Designer (v1) → Variation 02 (Workspace)** for the canonical
layout.

### 2a. Top-level routes

```
/designer                        # passport list
/designer/:id                    # workspace shell (default → pages)
/designer/:id/cover              # cover editor
/designer/:id/pages              # page/spread editor
/designer/:id/pages/:sectionId   # editing one section's pages
/designer/:id/stops              # stops list / map mode
/designer/:id/stops/:stopId      # one stop, with map pin + lat/lng
/designer/:id/stops/new          # add stop (map mode)
/designer/:id/theme              # theme/colors/cover preset
/designer/:id/pricing            # pricing & redemption rules
/designer/:id/publish            # publish flow
```

### 2b. Workspace shell (every `/designer/:id/*` route)

Three columns, total height = full viewport minus the connect chrome:

1. **Left rail (~170px):**
   - Passport name (large, bold) + draft/published chip
   - Workshop sections (active highlighted with a 2px gold left-border):
     `Cover · Pages · Stops · Theme · Pricing · Publish`
   - Below: a flat list of the passport's sections (e.g. `I. Williamsburg
     · II. Bushwick · …`), highlighting the one being edited. Each section
     row is small, tight; selected row gets a white background + 1px ink
     border.
   - "+ section" button at the bottom of that list.
2. **Center canvas:** swaps based on the route. See 2c, 2d, 2e below.
3. **Right inspector (~240–280px):**
   - Selected-element details (name, slug, etc.)
   - Action buttons (replace, delete, regenerate)
   - Live validation hints (red text if a stop has no pin, etc.)

The chrome at the very top of the canvas:
- Tool toolbar (left): `▢ slot · ⌖ pin · T text · 📷 image`
- Action buttons (right): `undo · preview · save` (save is solid `--green`)

### 2c. Pages route — `/designer/:id/pages`

Center canvas shows a **two-page passport spread** at fixed proportions
(read the proportions off the wireframe — page is ~280×380, cream paper,
2px ink border, 6/8 drop shadow, inset shadow, faint horizontal rules). The
two pages sit side-by-side with a darker spine shadow between them.

The author can:
- **Drag stamp slots** onto the page from the toolbar's `▢ slot` tool. Each
  slot is a bounding box; corner handles let the author resize. A faint grid
  on the page is visible only while editing.
- **Select** a slot to populate the inspector with: stop name, stamp artwork
  (color swatches), bounding box X/Y/W/H, and the linked map pin.
- **Re-order pages and sections** by drag in the left rail.
- **Add chapter art** — a per-page non-stamp element (a section heading, a
  pull quote, a section-prize callout). Use the toolbar's `T text` and
  `📷 image` tools.

Bottom of canvas: a small page picker (`‹ pp. 2–3 ›`).

### 2d. Stops route — `/designer/:id/stops` and `/.../new`

Center canvas swaps to a **map** with a list rail.

- **Add stop:** click on the map to drop a pin; the inspector opens with
  fields for name, address (autofilled from reverse-geocode), lat/lng (read-
  only), radius (slider, 20–200m), verify mode (`GPS · QR · manual`).
- **Existing stops** show as numbered pins on the map. Selecting one focuses
  the inspector and centers the map.
- **Search bar** at the top of the canvas: address / business name → places
  pin at the result. Satellite/street toggle in the top-right.
- **Radius ring** drawn around the selected pin (dashed, 50% gold fill).
- The list rail (left) shows all stops grouped by section, drag-reorderable.

A stop is the anchor for one or more stamp slots in the Pages view. Wiring
happens in either direction:

- From a slot's inspector (Pages view): "Link pin →" opens a picker.
- From a pin's inspector (Stops view): "Assigned to" shows the page/slot.

### 2e. Cover, Theme, Pricing, Publish

Smaller scope; the wireframe shows the directional treatment for Cover. Build
those routes as straightforward forms inside the same workspace shell.

### 2f. Components to ship as part of Designer

- `<PassportPage>` — re-uses the same passport page primitive as the mobile
  app's reader. Same dimensions (2:3-ish, 280×380 at editor scale), same
  paper/ink border treatment, same horizontal rules. **Critical:** authors
  must be designing on the exact same surface their users will read.
- `<StampSlot>` — bounding box with stamp art. States: `empty · linked ·
  selected`. Selection draws four corner handles + a stop number badge.
- `<Inspector>` — right rail; rendered fields driven by selection type.
- `<MapWithPins>` — for Stops view. Use whatever map component the codebase
  already has; if none, Mapbox GL JS.
- `<DesignerToolbar>` — center top toolbar.

### 2g. Source files affected

- New routes under `app/designer/...` matching 2a.
- A `components/designer/` folder for the components in 2f.
- The shared `passport/PassportBook.tsx` / `PassportCover.tsx` should be
  factored so the editor can render a single page as a child component
  without dragging in reader-only state (animations, swipe handlers).

---

## What to do first

1. **Employee Terminal first.** Smaller scope, unblocks venue testing. Get
   the dashboard card + Counter layout + 2-step flow working end to end.
2. **Designer Workspace shell next.** The 3-column layout + left-rail
   navigation + an empty canvas is enough to make the rest tractable.
3. **Pages editor.** Drag-place stamp slots; persist their bounding boxes.
4. **Stops + map.** Wire pins to slots.
5. **Cover, Theme, Pricing, Publish.** Polish.

---

## Asking us

If something in `wireframes.html` is ambiguous, ask. Don't invent flows or
fields that aren't shown — we removed them on purpose. The wireframes are the
source of truth for layout and IA; this doc is the source of truth for
behavior and routes.
