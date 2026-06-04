# Okuji Kōbō Designer — Interface Walkthrough

This is a ground-truth, surface-by-surface account of the passport designer
**as it currently exists** in the okujiKobo web app, written from the user's
perspective. Exact labels are in quotes. Rough edges and configuration-dependent
features are flagged inline so the training guide can route around them.

---

## 1. Getting in + the passport list ("My Passports")

**URL**: `/design` · **Page title**: "My Passports — OkujiDesigner"

On entry the user sees a top bar with the Okuji rounded-tile icon and the
serif wordmark **"OkujiDesigner"** on the left, a `← Back to Okuji` link on the
right. The body greeting is **"My Passports"** with a subtitle showing the
count (`"N passports"`) or, on first visit, **"Create your first passport
to get started."**

The primary action is a **New passport** button (top-right and, on the empty
state, repeated inside a dashed-border empty card with the headline
**"No passports yet"**, the 🗺 emoji, and a **"Create your first passport to
start building experiences."** body).

Each existing passport appears as a card in a responsive grid (1 / 2 / 4
columns depending on width). Each card shows:

- A **cover thumbnail** (2:3 proportions, top of card) — uses the saved
  cover_outside_data design, or the saved cover image, or a fallback color
  swatch with the type emoji.
- The passport **title** (clicks straight into the editor at `/design/[id]`).
- A status pill: `draft` (gray), `published` (cream w/ green), `archived`
  (gold).
- The description (if set), truncated to two lines.
- The **expected spend tier** label ("Free", "Under $15", "$15 – $50", etc.)
  or "Not set" if absent.
- Accessibility emoji: 🚌 (transit), ♿ (wheelchair) when those flags are set.
- "Updated {date}".
- A footer with a compact **Print** button (the printer icon + "Print").
  Clicking it generates and downloads the print-PDF directly (see §9).

### Creating a new passport

Clicking **New passport** routes to `/design/new` ("Start a new passport"
with the subtitle **"Choose how you want to begin building your experience."**).

Three option cards in a row:

| Card | Action | Status |
|---|---|---|
| **"Start from scratch"** — "Blank passport. Your design, your stops. Full creative control from the first page." | A "Start blank" button creates a passport and lands the user in the editor at `/design/[id]`. | Works. |
| **"Import from library"** — "Build around educational stops you've found. Browse the community library and import stops into a new passport." | "Browse stops" link to `/stops`. | The library page is separate; flows back into a new draft. |
| **"Use a template"** — "Pre-built framework for common destinations…" | Disabled. Shows the pill **"Templates coming soon."** | **Not implemented.** |

> **Rough edge:** "Import from library" jumps the user to the community stops
> page, not back to the new-passport step. Coming back from there to actually
> create a passport is a separate flow.

---

## 2. The designer workspace layout

**URL**: `/design/[id]` · The workspace is full-screen, no app chrome
above it. Layout from top to bottom:

### Top bar (sticky, full width)

Left side: `← My Passports` (saves dirty changes before navigating; the
label changes to "Saving…" while the flush is in flight). To the right of
it, a `·` divider and the passport's **title** (truncated).

Right side, in order:
- **Save indicator** — one of:
  - "Saved 10:42" (last-saved time)
  - "Unsaved changes" (gold text)
  - "Saving…" (gray)
  - "Save failed" with a **Retry** button (red)
- **Save** button — disabled when nothing is dirty; primary-styled when there
  are unsaved changes. Keyboard shortcut: Ctrl/⌘-S.
- Status pill (`draft` / `published` / `archived`).
- **Print** button (ghost) — direct PDF download, label "Generating…" while
  in flight. Any error shows inline next to the button.
- **Settings** button — opens the right-side **Passport Settings** drawer
  (see §3 / §8).
- **Publish** button — only visible when the passport is NOT yet published.
  Opens the publish flow (see §8).

### Tab strip (under the top bar)

A horizontal strip with:

- **"Cover"** tab (always first).
- A `·` divider.
- One tab per page — labeled with the page's "Title", falling back to its
  "Section name", falling back to "Page N".
- When there are zero pages, an inline italic hint: **"Add a page from the
  left panel."**

The active tab has a green underline and green text.

### Workspace columns (everything below the tab strip)

Two modes depending on which tab is active:

**Pages mode** (any page tab):

```
┌────────────────┬──────────────────────────┬────────────────────┐
│ LeftPalette    │ Canvas                   │ RightInspector     │
│ (rail, w-60)   │ (the 612×792 page mat,   │ (workspace bg,     │
│                │  dark espresso mat       │  w-280)            │
│                │  behind the page)        │                    │
└────────────────┴──────────────────────────┴────────────────────┘
```

**Cover mode** (the Cover tab):

```
┌────────────────┬──────────────────────────┬────────────────────┐
│ CoverPalette   │ CoverCanvas              │ CoverInspector     │
│ (rail, w-60)   │ (1248×792 spread on the  │ (workspace bg,     │
│                │  dark mat, w/ Outside /  │  w-72)             │
│                │  Inside face toggle)     │                    │
└────────────────┴──────────────────────────┴────────────────────┘
```

What each region is for:

- **Left rail (LeftPalette / CoverPalette)** — passport meta, the Pages list,
  the Stops list (on stamp pages), and "+ Add" buttons for pages, stops, and
  page elements (text / image / line).
- **Canvas** — the live render of the current page (or the unfolded cover
  spread). Click stops, elements, or panels to select them. Drag to move,
  drag corner handles to resize. The mat is dark espresso so the paper-colored
  page sits on it visibly. A floating zoom pill (`−` / `+`) sits bottom-right.
- **Right inspector** — context-sensitive: shows controls for whatever is
  selected (Stop, Image / Text / Line element, Page, or — when nothing is
  selected — the Passport).

---

## 3. Pages

### Adding a page

Bottom of the LeftPalette's "Pages" section: **"+ Add page"** button.

Clicking it opens a modal **"What kind of page is this?"** with subtitle
**"Choose a page type to continue."** and two cards side-by-side:

- 📮 **"Stamp page"** — "Has location boxes for collecting stamps"
- 📄 **"Information page"** — "Text, images, and decorative elements only"

A "Cancel" link sits below. The new page lands at the end of the page list.

### Page types

| Type | Has stops? | Has elements? | Use |
|---|---|---|---|
| **Stamp** | Yes — left rail shows a "Stops" section with "+ Add stop". | Yes — text / image / line elements layered above the stop boxes. | Collectors physically stamp these pages at locations or on completion. |
| **Information** | No — the entire "Stops" section is hidden from the rail. | Yes — labeled "Content elements" in the rail. | Cover-adjacent intro, journal lines, prize details, etc. The inspector also shows a cream banner: **"📄 Information page — no stamps collected here."** |

### Reordering pages

Each row in the Pages list has a `⋮⋮` drag handle (left). Drag vertically to
reorder. Order persists when the user clicks Save.

### Deleting pages

> **Rough edge:** There is no in-UI control to delete a page. To remove a
> page, the user has to delete the row directly via the database (or recreate
> the passport). Flag this in the training guide.

### Page settings (Right inspector, when the page is the selected target)

The inspector's header reads **"PAGE"** (small caps) above the page's title.

Sections:

**Section** —
- **Title** (`section_title`) with placeholder **"e.g. Downtown Historic District"**.
- **Subtitle** (`section_subtitle`) with placeholder **"Optional tagline"**.

**Background** —
- **Type** dropdown: "Guilloche" / "Grid" / "None" / "Custom image". (Legacy
  "Landscape (legacy)" only shows if a row already has that value.)
- **Paper color** — 6-character hex (no `#`), with a swatch-style color
  picker beside it.
- **Pattern color** — only for Guilloche / Grid. Same hex + picker pair.
- **Opacity: N%** slider (10–100) — only for Guilloche / Grid. Hint:
  **"10–100%. Keep low for stamp legibility."**
- For **Custom image**:
  - **Image opacity: N%** slider (10–100).
  - Checkbox **"Full color background"** (toggles opacity between 100 and 10).
  - **CustomBgPicker** — see §6.

**Prize** —
- **Prize description** — placeholder **"Complete all stops to unlock…"**
- **Location constraint** — placeholder **"Redeem at front desk"**

---

## 4. Stops

### Adding a stop

In the LeftPalette's "Stops" section (visible only on stamp pages): **"+ Add stop"**.

Default values: name "New Stop", emoji 📍 in green, a 120×120 box on the page,
honor-tier verification (Event/Activity) by default.

### The stop inspector

Header **"STOP"** + the stop's name. Sections, in order:

**Name** — free text.

**Rotation (°)** — 0–359.

**QR code** — only appears when the stop's verification method is "QR code".
Read-only "Generate token" button calls the `provision-qr-token` edge function;
on success the token populates the field.

**Stamp** —
- **StampPicker** — see §6.
- **Ink color** — 6-char hex + swatch picker.
- **Smudge** — four buttons in a row: **None / Light / Medium / Heavy**.

**Location & verification** — the canonical stop-type controls. The single
most important section here:

- **Stop type** dropdown:
  - **"Location (a place you go)"**
  - **"Event / Activity (not physical)"**

If **Event/Activity** is chosen, a muted hint appears:
**"Self-reported. Visitors confirm completion on the honor system — no
address, coordinates, or verification needed."** No further location fields
show. Verification tier is forced to 5 (honor).

If **Location** is chosen, the following appear:

- **PlaceSearch** (a Google Places autocomplete). One result populates
  street/city/state/zip/country and lat/lng in one shot.
  > **Renders nothing** if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset.
  > Manual fields still work.

- **Verification method** dropdown — four options, each with a hint
  shown beneath:

  | Value | Label | Hint |
  |---|---|---|
  | `gps` | **GPS** | "Phone confirms location within the radius. Coordinates required." |
  | `qr` | **QR code** | "Visitor scans a code on-site. Address required for wayfinding." |
  | `witnessed` | **Staff-witnessed** | "Staff or host signs off the visit on the terminal." |
  | `documented` | **Evidence-documented** | "Visitor submits a photo or receipt as proof." |

- **Address fields** (Street, City, State / Province / Region, Postal / ZIP,
  Country). City and Street are starred (required) only for **QR**; otherwise
  optional but recommended for wayfinding.

- **Lat / Lng** — two number fields. Starred (required) only for **GPS**.
  Otherwise optional.

- **"Pick on map"** button — opens the MapPickerDialog. Drag the pin to
  set coordinates; "Confirm" writes them back into Lat/Lng.
  > **Hidden** when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset; replaced by
  > the muted note **"Map picker unavailable — enter coordinates manually."**

- **GPS radius (meters)** — only for GPS and QR. Default 150, min 10, max 5000.

### What each method requires at a glance

| Method | Required fields | Notes |
|---|---|---|
| **Event/Activity** | none | Forced honor; no location at all. |
| **GPS** | lat **+** lng | Phone validates location within the radius at stamp time. |
| **QR code** | address (street + city) | Visitor scans a printed QR on-site. |
| **Staff-witnessed** | none | Address + coords optional. |
| **Evidence-documented** | none | Address + coords optional. |

### Educational metadata (still on the stop inspector)

**Learning** section:
- **Learning objective** — placeholder **"e.g. Identify three bird species"**.

**Educational** section:
- **Journal prompt** — multi-line, placeholder **"What did you observe here?
  What surprised you?"**
- **Classifiers** — 30 toggle chips (General, Educational, Heritage, Nature,
  Food & Drink, Arts & Culture, Family, Accessible, Challenge, Hidden Gem,
  Learning, Tour, Outdoor, Architecture, Wildlife, Marine, Brewery, Wine,
  Coffee, Music, Theater, Photography, Cycling, Winter, Night, Spiritual,
  Industrial, Garden, Schools, Science).
- When **Educational** is selected, two more chip rows appear:
  - **Grade levels**: K–2, 3–5, 6–8, 9–12.
  - **Subject areas**: Science, History, English, Math, Art, Social, STEM,
    Environment.

**Share with the community** section — only visible when **Educational** is
in the classifier list. Single checkbox **"Share this stop"** with body
**"When shared, other educators can import this stop into their passports.
Your name and institution will be credited."**
> **Gated**: the checkbox is disabled with the note **"Educational stops can
> only be shared by verified institutional accounts."** when the creator has
> no institution.

**Delete stop** — danger button at the very bottom, with a JS `confirm()`
dialog (`Delete stop "{name}"?`).

### Per-stop expected-spend tier

> **There is no per-stop spend tier control.** Expected spend is a
> **passport-level** field set in the Settings drawer (see §7 / §8). Per-stop
> spend appears only in the AI verification breakdown.

---

## 5. The cover editor

Activated by clicking the **"Cover"** tab. Renders the unfolded 1248×792
wrap on the dark canvas.

### Face toggle (at the top of the canvas)

Two pill buttons centered: **"Outside"** / **"Inside"**, plus a hint to the
right:
- with no image: **"Click a half to select it"**
- with a full-bleed image: **"Drag image to reposition · Click panel to select"**

### The wrap model

The canvas is a single 1248×792 surface divided by a 24px gutter labeled
**"Spine"** (vertical dashed line). The two halves are real gaps in the
artwork — the spine is the physical fold.

- Left half = **Back** panel (bottom-center pill labeled "Back").
- Right half = **Front** panel ("Front").

Clicking a half selects it (green inset ring). The CoverInspector then shows
controls for the selected panel.

### CoverPalette (left rail)

Header **"Cover — outside" / "Cover — inside"**. Below, **"Cover elements"**
with three "+ Add" buttons:

- 𝐓 **Add text block**
- — **Add H-line**
- | **Add V-line**

Helper text underneath: **"Click any element on the canvas to select and
edit it. Text blocks are draggable and resizable."**

### CoverInspector (right column, w-72)

Header reads **"Outside cover — Front panel"** (or the appropriate variants).

When a **text element** is selected, an inline card appears with: Content
(textarea), Size (px), Weight (Normal / Bold), Align (Left / Center / Right),
Color (hex + picker).

Below that, always present:

- **Front background color** / **Back background color** — 6-char hex + swatch.
- **Full-bleed image (both panels)** section — when no image is set, an
  **"+ Upload cover image"** dashed-border button (and the scope checkbox
  described in §6). When an image IS set, the section shows:
  - Preview thumbnail
  - **Opacity** slider (10–100%)
  - **Position & scale** card with X / Y offset number fields and a scale
    control
  - Replace and remove actions

### How the front cover relates to cards

The **Front** panel of the Outside face is what shows on the My Passports
card thumbnail and in Explore listings — the back panel and inside face are
only printed.

---

## 6. Images & assets

### Uploading from inside the designer (page background, stamp, image
element, cover image)

Every designer upload sits next to a small unobtrusive checkbox:

> ☐ **"Also save to my general library"**

When **unchecked (default)**, the upload is **scoped to this passport only** —
it shows in this passport's pickers but not in any other passport's pickers.

When **checked**, the upload becomes **library-wide** — shows in every
passport's picker.

This default applies to the **CustomBgPicker** (page background),
**ImageElementPicker** (page image element), and **CoverInspector** cover
image. The **StampPicker** does not have an inline upload (stamps are
uploaded from the Assets section); but the picker DOES filter by scope.

> **Note:** Selecting an Okuji preset background does NOT trigger an upload —
> the preset comes from the platform's bundled assets and doesn't get a scope.

### Uploading from the Assets section (`/assets/[type]`)

Always **library-wide**. No prompt, no scope toggle — being in the Assets
section IS the intent. Tabs: **"Backgrounds"** / **"Stamps"** / **"Covers"**.
> Page images uploaded from the inline image-element picker (asset_type
> `image`) do not appear under any tab here — there's no "Images" tab.

The header reads **"Assets"** with a tab strip below it; each tab shows the
asset count and an **"Upload asset"** button (top-right of the section).

### What the picker shows (designer side)

For backgrounds: a section labeled **"Okuji presets"** (the six
`okuji-ground-XX` bundled grounds: "Guilloche medallion", "Topographic
contours", "Woven waves", "Trail waypoints", "Rosette tiling", "Field rule"),
followed by **"Your uploads"** — library + this-passport-scoped only.

For stamps: **"My uploads"** (the user's stamps) and **"Institution stamps"**
(stamps owned by the user's institution), both filtered by scope. Below
those, the built-in **"Built-in stamps"** emoji grid (50+ travel / nature /
activity emojis).

For image elements: a single **"Your uploaded images"** grid, filtered by
scope.

### Placing an image (on a page)

In the LeftPalette **"Elements"** section: **"🖼 Add image"**. A 200×200
empty box drops onto the canvas; the inspector switches to **IMAGE** and
shows the ImageElementPicker — either pick an existing upload or upload a
new one. Drag the box on the canvas to move; corner handles resize; the
inspector has Opacity, Rotation, Size, etc.

### Cover full-bleed image

In the CoverInspector when no image is set: **"+ Upload cover image"** in
a dashed-border drop zone. Once uploaded, the image spans both Outside
panels (the "Full-bleed" name). Drag it directly on the canvas to reposition;
use the X/Y offset / scale controls in the inspector for precision.

### Assets section: scope chip, usage list, delete

Each owned card on `/assets/[type]` has three controls below the preview:

- A **scope chip** ("Scope: Library" or "Scope: Scoped — Untitled Town
  Walk") with an expandable selector. Expanding lets the user reassign the
  asset to **"Library (every passport)"** or to any of their passports
  ("Scoped to: {title}").
  - If the new scope would hide the asset from passports currently using
    it, a confirm card lists those passports with the warning **"This change
    will hide the asset from N passports that currently use it. Existing
    placements stay, but creators won't see it in those pickers anymore."**
    Buttons: **"Change scope anyway"** / **"Cancel"**.
- **"Used in passports"** expander — lists each passport the asset is placed
  in, with chips for the kind of placement: "page background", "page image",
  "stop stamp", "cover". States **"Not used by any passport."** when empty.
- **Delete** (trash icon, top-right of the preview) — disabled (and silent)
  if the asset is in use; the underlying delete endpoint refuses with **"Asset
  is in use. Remove it from those passports before deleting."**

### Built-in / institution-shared assets

The cards for built-in assets and institution-shared assets do NOT show the
delete button, the scope editor, or the usage list — these are managed
elsewhere. Institution-shared assets show a small green **"Shared"** chip
on the card footer.

---

## 7. Saving

The designer is **always live-editing in a local store**, then writes
asynchronously. There are three layers, in the order they fire:

1. **Per-mutation debounced persist.** Almost every action in the inspector
   schedules a coalesced write to the underlying row (passport / page / stop /
   element). Editing a text field and tabbing away triggers a write a moment
   later.

2. **Manual Save** (button + Ctrl/⌘-S). Flushes any pending debounces and
   runs a whole-passport sweep so everything is on disk before the user moves
   on. The Save button is greyed out when there's nothing to write and brightens
   to primary blue when "Unsaved changes" appears.

3. **Autosave backstop** (every 30 seconds). If the store is still dirty and
   not currently saving, it flushes + saves. Safety net for any new mutating
   action that forgot to wire the per-mutation persist.

### What the user actually sees

The save indicator in the top bar tells the truth:

- **"Saved 10:42"** — clean, on disk.
- **"Unsaved changes"** (gold) — there are dirty fields the per-mutation
  persist hasn't yet pushed. Saving usually catches up in a second.
- **"Saving…"** — a save is in flight right now.
- **"Save failed"** (red) — both the per-mutation and the autosave failed.
  A **Retry** button appears next to it.

### What the user should trust

- Leaving the editor with **`← My Passports`** flushes saves first, then
  navigates. If the flush errors, the user gets a confirm dialog: **"Your
  changes could not be saved ({err}). Leave anyway and lose them?"**
- Closing the browser tab while dirty triggers the browser's "Reload site?"
  confirmation (no Okuji-specific message; the OS dialog).
- Page reordering by drag is local-only until the next Save (or autosave
  tick). If the user reloads before saving, the order resets.

> **Rough edge:** Some unusual actions (e.g. the cover face-toggle's
> selection ring) update the store immediately but the persist round-trip
> can lag by hundreds of milliseconds. Don't assume "I clicked, it's saved."
> Watch the indicator.

---

## 8. Publishing

The **Publish** button in the top bar (only when status is `draft`) opens
a four-step modal flow:

### Step indicator

A breadcrumb across the top: **Checklist → Spend → Pricing → Confirm**.
The active step is dark navy; completed steps show a green ✓.

### Step 1: Checklist ("Before you publish")

Lists issues that block publish. The list ends up empty for a clean draft;
otherwise each issue is a row with a red ✗ and a one-liner. Possible
messages, verbatim:

- "Give your passport a real title." (if title is empty or still "Untitled
  Passport")
- "Add at least one page."
- "**N** GPS stop(s) need coordinates. Open the stop and use the map picker."
- "**N** QR stop(s) need an address."
- "Set an expected spend tier (Settings → Expected Spend)."
- "Publishing a personal passport to the marketplace requires Studio. Ask
  an admin for a Studio comp at /access/comp-subscriptions." (when the
  creator's profile has no active Studio subscription and the passport has
  no institution.)

**Honor / Event-Activity stops are NEVER flagged** — they're location-less by
design, and the validator correctly excludes them.

When clean, a green summary card appears: Pages count, Stops count, Status.

Buttons: **"Cancel"**, **"Continue →"** (disabled when there are issues).

### Step 2: Spend confirmation

Header **"Spend confirmation"**. Body confirms the previously-set tier
("You've set the expected spend as **{tier}**.") and asks the creator to
confirm by clicking **"Confirm →"**. If they need to change it, they back
out and open Settings.

### Step 3: Pricing

Header **"Pricing"**. A single `$` input field. **"Set to $0 for a free
passport."** Either is valid.

### Step 4: Confirm

A summary table (Title / Stops / Spend / Price / Accessibility), then the
big **🚀 Publish** button. While publishing the label changes to "Publishing…".

### After publish: page-image generation

Right after the DB write succeeds, the designer runs
`generateAndUploadPassportImages` to render each page to a PNG and upload to
the `passport-pages` storage bucket. Used by Explore for fast cards / preview.

> **Failure-tolerant:** Image generation failures don't block publish —
> Explore falls back to live-rendering and the next republish retries. The
> creator never sees an error from this step.

### Who can publish publicly

- **Personal passport** (no `proprietor_id`) → creator needs an active
  **Studio** subscription. Validated client-side in step 1 and enforced by a
  DB trigger; the trigger is the real gate.
- **Institutional passport** → governed by the standard institution
  designer/manager roles (`can_design` RLS).

### What publishing makes happen

- `status` → `published`, `is_published` → `true`, `published_at` stamped,
  `price_cents` set.
- The passport appears on the public Explore page and is available for
  collectors to download.
- Free published passports get a printable PDF link on Explore (see §9).

### The success step

A 🎉 emoji on cream, **"Published!"** with the title underneath. Single
**"Back to editor"** button closes the modal. The top-bar status pill flips
to **"published"** (green); the **Publish** button disappears.

> **Rough edge:** There's no unpublish UI in the designer. Republishing
> after edits requires a separate flow (or a direct DB update); not exposed
> here.

---

## 9. Printing

### Where it lives

Three trigger points, all calling the same `/api/passports/[id]/print-pdf`
endpoint and downloading the resulting PDF directly:

1. **My Passports card footer** — small "Print" button on every passport
   card.
2. **Editor top bar** — "Print" button (ghost-styled).
3. **Settings drawer → Print for kids section** — only for institutional
   passports with **"Enable physical passport printing for this passport"**
   checked. The button is labeled **"🖨 Print for kids"**.

### What happens

A single POST, no options. The route generates a multi-sheet 8.5×11" booklet
PDF (cover + pages, both sides of each sheet) and the browser downloads it
named `{passport title} — printable.pdf` (approx; format varies).

### Cut / stack / fold / staple

Each printed sheet has a **discardable strip** across the top with these
instructions in icons: **1. Cut** along the horizontal line on every sheet;
**2. Stack** strips in numbered order (lowest on top); **3. Fold** the stack
along the vertical center line; **4. Staple** three times through the fold.
A footer line on the strip says **"Print at 100% scale · Duplex: long-edge /
book · Portrait orientation."** Free passports get a marketing block on the
left half of this strip with the woven-waves design and `okujikobo.okuji.app`
underneath; paid passports keep the full-width instructions.

> **Errors** during PDF generation surface inline at the button (`Generating…` →
> the error text in red). Click the `×` next to the error to dismiss.

---

## 10. Other things a first-time creator will encounter

### Settings drawer (gear button in the top bar)

Slides in from the right. Sections, top to bottom:

- **Details** — Title, Description (textarea).
- **Cover** — Emblem (emoji, 4 chars max — visible on the card / share
  surfaces), Paper color (hex).
- **Accessibility** — 🚌 Transit accessible, ♿ Wheelchair accessible.
- **Print for kids** (institutional passports only) — toggle that enables
  the print button described in §9.
- **Expected Spend** — the six-tier picker:
  Free / Under $15 / $15 – $50 / $50 – $150 / $150 – $500 / $500+
  plus an optional **Spend note** field ("e.g. Includes one meal").
- **"✨ Verify with AI"** — sends the stops to a server-side estimator;
  comes back with a card showing the suggested tier, a $low–$high range,
  reasoning, and a per-stop breakdown. Buttons: **Accept my tier** / **Use
  AI suggestion** (only when there's a mismatch) / **Keep mine**. Decision is
  logged.

### Passport inspector (when nothing else is selected on a page)

Header **"PASSPORT"**. Sections: Title, Description, **Type** (three big
selectable cards):
- **Adventure** — "Visit physical places and landmarks"
- **Challenge** — "Complete activities or experiences"
- **Educational** — "Learn and discover along the way"

Plus Accessibility checkboxes (same two flags as the drawer).

### Element inspector (when a text / image / line / cover element is selected)

- **Text**: Content (multi-line), Size (px), Weight, Align, Font (Arial /
  Inter / Georgia / Playfair Display / Lora / Bebas Neue / Abril Fatface),
  Color (hex + picker), Rotation (°), Opacity (image), plus position fields.
- **Image**: ImageElementPicker (see §6), Opacity.
- **Line**: Thickness, color, endpoints draggable on the canvas.

### Keyboard shortcuts

- **Ctrl/⌘ + S** — Save.
- **Ctrl/⌘ + ,** — open Settings.
- Selection / element handling uses normal click + drag; arrow keys do NOT
  nudge.

### What happens if you walk away

- The 30-second autosave will catch most loose edits.
- Closing the tab while dirty triggers the browser's "Reload site?" prompt.
- The `← My Passports` link flushes saves before navigating; if the flush
  errors, the user sees an explicit confirm.

### Configuration-dependent surfaces (mark as "if available")

| Surface | Depends on |
|---|---|
| PlaceSearch autocomplete on stop addresses | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| "Pick on map" button + MapPickerDialog | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| "Verify with AI" spend suggestion | `OPENAI_API_KEY` (or whatever LLM env var the route uses); fails with `verifyError` text inline if absent |
| Page-image generation at publish | Browser must be able to dynamic-import the publish-images bundle; failure is silent but logged |
| Free-passport marketing strip on the print PDF | `okuji-ground-03-woven-waves.png` present in `public/presets/png/` |

### Things known to be missing / rough

- No **delete page** UI.
- No **unpublish** UI.
- Templates option on "New Passport" is disabled ("Templates coming soon").
- No **per-stop** spend tier control — only passport-wide.
- The `image` asset type has no tab in the Assets section; image-element
  uploads can only be managed via the inline picker's per-thumbnail delete.
- Cover face toggle's selection ring + persisted state can lag by a few
  hundred ms — visible save indicator is the only source of truth.
- The cover inspector's text-element card and the page text-element
  inspector are slightly different (the cover version uses a green-fill
  "active" align button; the page version uses cream-fill) — same fields,
  different chrome.
