# Passport Markup Spec — how a passport is represented, stored, and rendered today

**Status:** investigation report (no code/schema/seed changes). Authored to ground a future
Passport Designer agent. Every non-obvious claim cites `file:line`. Anything that could not be
resolved from the code is listed as an **OPEN QUESTION** rather than guessed.

Repo root: `/home/user/PanTest`. "Mobile" = Expo app at repo root (`app/`, `components/`, `lib/`,
`types/`). "Web / kobo" = `okujiKobo/`.

---

## 0. Schema sources (read first — every later citation depends on this)

The passport schema is **not** in one place. There are three SQL trees plus a referenced-but-absent
file, all targeting the same `public.*` tables:

1. **Mobile tree** `supabase/migrations/` (`001`–`031`) — the only tree that `CREATE`s the base
   tables (`supabase/migrations/001_initial_schema.sql`).
2. **Web tree** `okujiKobo/supabase/migrations/` (`002`–`108`) — only ever `ALTER`s
   `passports`/`passport_pages`/`stops`; never `CREATE`s them.
3. **Consolidated baseline** `okuji-db/supabase/migrations/000_baseline.sql` — a hand-authored
   "fresh DB" snapshot, header "generated 2026-05-06 … as of Blockpoint 3" (`okuji-db/supabase/migrations/000_baseline.sql:1-5`). Authoritative-looking full DDL but **not a real applied migration**.
4. **MISSING `002_designer_schema.sql`** — named as a prerequisite at
   `okujiKobo/supabase/migrations/002_connect_schema.sql:2` and is the implied DDL origin of the
   `institutions` table and the entire web-side `stops` column set. **Not present in the repo.**

**Most authoritative live shape:** the introspected `okujiKobo/lib/supabase/database.types.ts`
(passports `Row` at `:1445-1511`). It is a snapshot and lags the newest migrations (omits
`is_okuji_official` (107), `punch_*` (086), `completion_required_stops` (106); shows
`institution_id` and `cover_thumbnail_url` with no traceable migration — see Open Questions).

**Consequence:** because both lineages hit one `public.stops`, the live table is a **superset with
duplicated geo/verification columns** (mobile `target_location`/`radius_meters`/`qr_code_id`/
`evidence_tier`/`verification_type` **and** web `lat`/`lng`/`verification_radius_meters`/
`qr_code_token`/`verification_tier`/`experience_verification_method`). A designer agent must know
which it writes. Canonical choices are called out in §1 and §9.

---

## 1. Data model

### 1.1 `passports`

Base table (mobile) — `supabase/migrations/001_initial_schema.sql:48-71`. Required (NOT NULL, no
default) in the base: **`creator_id`** (`:50`, FK `profiles.id`) and **`title`** (`:52`). Other base
columns: `description` (`:53`), `passport_type` `DEFAULT 'location'` CHECK `('location','experience','learning')` (`:54-55`), cover/illustration/paper color defaults (`:56-65`), `is_published bool DEFAULT false` (`:66`), `is_free bool DEFAULT false` (`:67`), `price_cents int DEFAULT 0` (`:68`). **The mobile base has no `status` column** (confirmed also absent from the mobile `Passport` TS interface, `types/index.ts:51-79`).

Key columns added by the web tree (ALTERs):

| Column | Type | Required | Default / constraint | file:line |
|---|---|---|---|---|
| `is_demo` | boolean | NOT NULL | `DEFAULT false`, admin-write-guarded | `okujiKobo/supabase/migrations/039_passports_is_demo.sql:22` |
| `is_okuji_official` | boolean | NOT NULL | `DEFAULT false`, admin-write-guarded | `okujiKobo/supabase/migrations/107_passports_is_okuji_official.sql:25` |
| `credential_type` | text | NOT NULL | `DEFAULT 'persistent'` CHECK `('persistent','consumable')` | `okujiKobo/supabase/migrations/069_consumable_credential_passport.sql:47,55-56` |
| `expiry_duration_days` | integer | nullable | CHECK `IS NULL OR > 0` | `okujiKobo/supabase/migrations/070_passport_copy_numbering_and_expiry.sql:66,72-73` |
| `cover_outside_data` / `cover_inside_data` | jsonb | nullable | `DEFAULT '{}'` | `okujiKobo/supabase/migrations/007_cover_data.sql:5-6` |
| `cover_image_url` (rendered PNG) | text | nullable | — | `okujiKobo/supabase/migrations/048_passport_page_images.sql:19-21` |
| `completion_prize_description` / `_value_cents` | text / int | nullable | — | `okujiKobo/supabase/migrations/098_passport_completion_prize.sql:22-23` |
| `visibility` | text | NOT NULL | `DEFAULT 'public'` CHECK `('public','private')` | `okujiKobo/supabase/migrations/091_passport_visibility_review.sql:30-31` |
| `review_status` | text | NOT NULL | `DEFAULT 'pending'` CHECK `('pending','approved','rejected')` | `okujiKobo/supabase/migrations/091_passport_visibility_review.sql:32-33` |
| `proprietor_id` | uuid | nullable | web → `REFERENCES institutions(id)` (mobile `001:51` → `proprietors(id)`) | `okujiKobo/supabase/migrations/002_connect_schema.sql:39`, `012_blockpoint4.sql:34` |

`design_state jsonb` (`okujiKobo/supabase/migrations/009_blockpoint1.sql:47`) and the
`passport_autosaves` table are a parallel editor representation — **OPEN QUESTION** whether they
mirror or cache the normalized rows.

**`status` (special — contradicts CLAUDE.md §9).** Live DB type is `status: string | null` — nullable
**open text, no enum/CHECK** (`okujiKobo/lib/supabase/database.types.ts:1506`). No `ADD COLUMN status`
exists in either applied tree. The only DDL declaring the `draft|published|archived` CHECK is the
non-authoritative baseline (`okuji-db/supabase/migrations/000_baseline.sql:105-106`), and the web
code itself writes a **fourth** value `'custodial'` (`okujiKobo/supabase/migrations/049_account_closure.sql:221`), with the comment "No CHECK constraint exists on passports.status today (it's an open text field)" (`049:266-269`). So CLAUDE.md §9's "`draft|published|archived`, complete and closed" is an **application convention, not a DB constraint.** By contrast `visibility` and `review_status` **are** CHECK-enforced.

**`token_prefix` is not on `passports`** — it lives on `proprietors` (`supabase/migrations/009_proprietor_token_prefix.sql:15,22`, `DEFAULT 'OKJ'` CHECK `^[A-Z0-9]{1,6}$`) and `institutions` (`okujiKobo/supabase/migrations/032_unify_redemption_into_completion_tokens.sql:115`). It drives redemption codes `{prefix}-XXXX-XX`.

### 1.2 `passport_pages`

Base (mobile) — `supabase/migrations/001_initial_schema.sql:76-86`. Required: **`passport_id`**
(`:78`, FK CASCADE) and **`section_name`** (`:80`). Page ordering = `page_order int DEFAULT 0`
(`:79`), `UNIQUE(passport_id, page_order)` (`:85`). Added later: `section_title`/`section_subtitle`
(baseline `okuji-db/supabase/migrations/000_baseline.sql:128-129`), `page_type DEFAULT 'stamp'`
CHECK `('stamp','information')` (`okujiKobo/supabase/migrations/011_blockpoint3.sql:14`; baseline
`000:125-126`), `elements jsonb DEFAULT '[]'` (`okujiKobo/supabase/migrations/017_page_elements.sql:6`),
background columns (see §4–§5), **`closed_at`** soft-close (`supabase/migrations/020_passport_pages_closed_at.sql:35`),
**`expansion_id`** FK (NULL = base page) (`okujiKobo/supabase/migrations/100_passport_expansions.sql:46`).

### 1.3 `stops` — two overlapping column sets on one table

Base (mobile) — `supabase/migrations/001_initial_schema.sql:94-120`. Required: **`page_id`** (`:96`,
FK CASCADE) and **`name`** (`:98`). Mobile geo/verif/stamp concepts: `description` (`:101`),
`target_location geography(Point,4326)` (`:106`), `radius_meters float DEFAULT 150` (`:107`),
`qr_code_id text UNIQUE` (`:108`), `evidence_tier int DEFAULT 2` CHECK `1..5` (`:104-105`),
`verification_type DEFAULT 'presence'` CHECK `('witnessed','documented','presence','honor')`
(`:117-118`), `stamp_icon DEFAULT '🍺'` (`:109`), `stamp_color DEFAULT '#1D9E75'` (`:110`),
`stamp_shape`/`stamp_smudge` (`:111-116`). Mobile ALTERs add box position:
`box_x`/`box_y` numeric nullable, `box_width`/`box_height` numeric NOT NULL `DEFAULT 40`/`30`
(`supabase/migrations/007_stop_box_positions.sql:17-20`), and `lat`/`lng` double precision
(`supabase/migrations/008_stop_lat_lng_bridge.sql:18-19`).

Web/baseline set (different names for the same concepts; DDL in the missing designer schema, captured
in `okuji-db/supabase/migrations/000_baseline.sql:163-206`): `address_street/city/state/zip`
(`:169-172`), `country` (`okujiKobo/supabase/migrations/042_stop_country_location_type.sql:26`),
`geohash` (`:175`), `verification_tier int DEFAULT 1` — **derived, never written directly**
(`:176`; trigger below), `verification_radius_meters int DEFAULT 100` (`:177`), `qr_code_token`
(`:178`), `stamp_asset_id uuid` FK `design_assets` (`okujiKobo/supabase/migrations/012_blockpoint4.sql:555`),
`stamp_type DEFAULT 'emoji'` CHECK `('emoji','custom_asset')` (`012:556`), and the **canonical
verification pair**: `experience_type` CHECK `('location','experience')` (baseline `000:194`) +
`experience_verification_method` CHECK `('gps','qr','witnessed','documented','presence','honor')`
(`okujiKobo/supabase/migrations/046_canonicalize_stop_verification.sql:55-65`). Text extras:
`learning_objective` / `journal_prompt` (`okujiKobo/supabase/migrations/004_classifiers_roles.sql:27,23`),
`classifiers`/`grade_levels`/`subject_areas` text[] (`004:16-22`).

**CLAUDE.md §5 canonical model:** write `experience_type` + `experience_verification_method`;
`verification_tier` is derived by `sync_verification_tier_from_method()`
(`okujiKobo/supabase/migrations/046_canonicalize_stop_verification.sql:109-143`). `location_type` is
retired (`046:146-147`).

### 1.4 `stamps` (the collected-stamp instance — not design data)

Base — `supabase/migrations/001_initial_schema.sql:140-157`. `UNIQUE(user_id, stop_id)` (`:156`,
CLAUDE.md §2 invariant). Position within a stop's box: `stamp_pos_x`/`stamp_pos_y` float, CHECK
`0..100` (`:146-147`; `supabase/migrations/013_stamp_pos_domain.sql:41-48`). Appearance (saturation,
smudge, tilt) added by `okujiKobo/supabase/migrations/040_stamp_appearance.sql` and `083_stamp_tilt.sql`.
**A designer agent never writes `stamps`** — they are produced by collectors via the `verify-stamp`
edge function.

### 1.5 Covers / spine / back cover

No `cover_elements` table and **no back-cover-QR column**. Covers are columns on `passports` +
`design_assets`:
- Wraparound spread `1252×869` = back 612 + spine 28px(≈4mm) + front 612, stored as JSONB in
  `cover_outside_data`/`cover_inside_data` (`okujiKobo/supabase/migrations/007_cover_data.sql:5-6`;
  spine widened 24→28px by `okujiKobo/supabase/migrations/088_passport_spec_cover_spine.sql:28-87`).
  TS shape `CoverSideData` (`front_bg`, `back_bg`, `image_*`, `elements[]`) at `types/index.ts:84-93`.
- `cover_emblem` emoji glyph (`supabase/migrations/001_initial_schema.sql:60`, `DEFAULT '🧭'`).
- **Back-cover QR is rendered at print time, not stored** — derived from `is_okuji_official`
  (`okujiKobo/supabase/migrations/107_passports_is_okuji_official.sql:9-12`). The spine has **no
  artwork/label slot** (OPEN QUESTION in §9).

### 1.6 Triggers & write guards

All guards are `BEFORE INSERT OR UPDATE`, `SECURITY DEFINER`, `SET search_path = public, pg_catalog`.

- **`guard_passports_is_demo`** — `okujiKobo/supabase/migrations/105_passport_demo_admin_guard.sql:28-58`.
  Non-admin (`auth.uid() IS NOT NULL AND NOT is_platform_admin()`) cannot set/change `is_demo`
  (`RAISE … ERRCODE '42501'`, `:39,46`). **Service role / direct SQL (`auth.uid() IS NULL`) is
  exempt.**
- **`guard_passports_is_okuji_official`** — `okujiKobo/supabase/migrations/107_passports_is_okuji_official.sql:28-58`.
  Same shape; only a platform admin may set/change it.
- **`guard_profiles_platform_admin`** — `okujiKobo/supabase/migrations/103_guard_platform_admin.sql:31-63`.
  Prevents admin self-promotion (the gate behind CLAUDE.md §4's single admin check).
- **`enforce_publish_gate`** (BEFORE INSERT OR UPDATE OF `is_published`) —
  `okujiKobo/supabase/migrations/045_publish_gate_studio.sql:34-105`. Only acts when
  `NEW.is_published IS TRUE` (`:48-53`); a **draft insert passes untouched**.
- **`sync_stop_target_location`** (`supabase/migrations/008_stop_lat_lng_bridge.sql:50-54`) and
  **`sync_verification_tier_from_method`** (`okujiKobo/supabase/migrations/046_canonicalize_stop_verification.sql:109-143`)
  keep `lat/lng`↔`target_location` and `verification_tier` in sync — not blockers.

---

## 2. Templates

Template type model — `okujiKobo/scripts/templates/types.ts`. `PassportTemplate` (`:88-110`):
`title`, `description?`, `passportType`, `expectedSpendTier?`, `expectedSpendNote?`, `pages[]`,
`isPublished?`, `coverEmblem?`, `isDemo?`. `PageTemplate` (`:82-86`): `{ title, subtitle?, stops[] }`.
`StopTemplate` is a discriminated union on `kind` (`:77-81`): `gps` (+`radius?`), `qr`, `honor`
(+`note?`). `PhysicalStopBase` (`:56-75`): `name`, `spend?`, `address?` (`AddressFields` street/city/
state/zip/country, `:48-54`), `lat?`, `lng?`, `place?` (free-form geocoder query resolved at seed
time).

**What a template does NOT define:** no per-stop description / fact / image / color field, and no
cover-color field. The only visual knob is `coverEmblem` (emoji). Cover + stamp colors are **seeder
constants**, not template data (see §2 pipeline and §5).

**Template → DB (the only seeder):** `okujiKobo/scripts/seed-sample-passports.ts`, run
`npm run seed:passport <name>`. Uses a **service-role client** (`createClient(url, SERVICE_ROLE_KEY, …)`,
`:137`; "service role bypasses RLS", `:8`) and requires `NEXT_PUBLIC_SUPABASE_URL` + `SEED_CREATOR_ID`
(`:129-134`). Flow: idempotent delete by title (`:143-155`) → insert passport with hard-coded cover
constants `cover_template:'guilloche_blue'`, `cover_paper_color:'F5F2EC'`, `cover_bg_color:'0D1B2A'`,
`cover_emblem: template.coverEmblem ?? '🧭'`, `status: publishNow ? 'published':'draft'`,
`is_demo: template.isDemo === true`, `is_okuji_official: true` for every seeded passport
(`:174-193`) → pages (`:207-231`, sets `page_order`, `section_*`, `elements:[]`) → stops (`:246-301`),
stamp defaults `stamp_icon:'📍'`, `stamp_color:'1D9E75'`, `stamp_type:'emoji'` (`:289-294`), and a
`...verification` spread from `mapKindToVerification` that sets only `experience_type` /
`experience_verification_method` — `verification_tier` deliberately omitted and derived by the 046
trigger (`:53-63,295-296`).

**Geocoding step: yes, optional.** For a stop with `place` and no explicit coords, `geocode(stop.place)`
(`lib/maps/server-geocode.ts:41-43`, Google Geocoding, `GOOGLE_MAPS_SERVER_KEY`) runs at
`okujiKobo/scripts/seed-sample-passports.ts:254-260`; skipped if the key is unset (`:239-244`).
Explicit template `address`/`lat`/`lng` always win (`:279-280`).

**What the 10/5 city templates have in common:** (the repo currently has five:
bainbridge, grand-rapids, port-orchard, portland, puget-sound-islands.) All are the same
`PassportTemplate` shape, all `passportType: 'location'`, all with `pages[] → { title, stops[] }`,
each stop `{ kind, name, spend (+address for physical) }`. **None sets `isPublished: true`** (all seed
as drafts, because `enforce_publish_gate` needs a real `auth.uid()` — e.g. `portland.ts:30-37`).
Variation: page/stop counts (8/24, 2/8, 4/17, 6/28, 10/28), `coverEmblem`, `isDemo` (only
grand-rapids, `grand-rapids.ts:41`), `radius` (only grand-rapids, `150`), and `place`-based
geocoding (only grand-rapids + port-orchard).

> **OPEN QUESTION:** the task said "10 city templates"; the repo has **5** (`okujiKobo/scripts/templates/`).
> The honor-stop `note` field (`types.ts:80`) is never read by the seeder — dead field or gap.

---

## 3. Page layout

**Stop placement = free coordinates in design units, stored per-stop.** Each stop carries `box_x`,
`box_y`, `box_width`, `box_height`, interpreted by every renderer as absolute positions in the
**612×869 design-unit artboard**. There is no fixed grid and no live slot system — the `stamp_slots`
table (migration 004) is explicitly dead (`supabase/migrations/007_stop_box_positions.sql:4-14`).

- **Mobile** is fully data-driven: `components/passport/DesignerCanvas.tsx:55-74` renders a
  `DesignerLocationBox` only when `box_x != null && box_y != null`; coords scaled by
  `scale = width/612` (`components/passport/PassportPage.tsx:54-56`). Default for a missing coord is
  `?? 0` (`components/passport/DesignerLocationBox.tsx:68-71`).
- **Web designer** edits absolute units; drag converts screen px → artboard units
  (`okujiKobo/components/design/LocationBox.tsx:100-105`), defaults `box_x/y ?? 40`, `w/h ?? 120`
  (`:47-51`), min box 40 (`:34`). New stops auto-layout in a 4-column grid, step 130
  (`okujiKobo/components/design/LeftPalette.tsx:330-333`).
- **Web explore SVG**: `okujiKobo/lib/explore/svg/PageSvg.tsx:256-259` (same absolute model, defaults
  40/40/120/120).
- **Print**: multiplies box coords by a pt/unit scale (`okujiKobo/app/api/passports/[id]/print-pdf/route.tsx:441-442,1119-1120`).

**Canonical dimensions:** `612×869` design units = 88×125mm, declared (copy-pasted, not shared) in
`okujiKobo/lib/print/passport-spec.ts:52-56`, `okujiKobo/lib/explore/svg/PageSvg.tsx:23,27`,
`okujiKobo/components/design/Canvas.tsx:20-21`, `components/passport/PassportPage.tsx:13,54-55`,
`components/passport/PassportFrame.tsx:18`, `okujiKobo/app/api/passports/[id]/print-pdf/route.tsx:77`.
`passport-spec.ts:49-51` names kobo the "graphical source of truth" and warns they must be kept "in
lockstep" by hand.

**Max stops per page: none.** No cap exists in schema, designers, or renderers — `handleAddStop`
inserts unconditionally (`okujiKobo/components/design/LeftPalette.tsx:315-348`). The auto-layout wraps
every 4 columns and runs off the 869-unit page after ~24 default-120 boxes with no overflow check.

> **OPEN QUESTIONS (layout):**
> 1. **box_x/box_y units.** Migration 007 declares them 0–100 **percentages** and backfills ~5–55
>    values (`supabase/migrations/007_stop_box_positions.sql:24-27`), but **all four renderers treat
>    them as absolute 612×869 design units** (defaults 40/120). These are incompatible; no percentage
>    code path was found. A designer agent should write **design units**, not percentages.
> 2. **box_height default mismatch:** DB default `30` (mobile `007:20`) vs renderer default `120`.
> 3. **Null-coord fallback diverges:** mobile `?? 0` vs web/print `?? 40`.
> 4. **No max stops per page** anywhere — undefined, not enforced.

---

## 4. Images

"Class A SVG / Class B PNG" is **spec terminology, not in the code** — no `class` column, no
`classA/classB` identifiers. Recolorability is inferred at runtime from
`file_format === 'image/svg+xml'` (+ `is_monochrome`), with recolor done by `currentColor` string
replacement (`okujiKobo/components/design/StampPreview.tsx:53`;
`okujiKobo/lib/design/stamp-composer/svg.ts:12-16`). Mapping below: **Class A = SVG/`currentColor`-
recolorable, Class B = raster (PNG/JPG), no recolor.**

Storage buckets (all public): `design-assets` + `avatars`
(`okujiKobo/supabase/migrations/008_storage_buckets.sql:4-8`), `passport-pages`
(`okujiKobo/supabase/migrations/048_passport_page_images.sql:29-31`).

| Slot | Class | Artboard | Bucket / path | Referencing column | Recolor? |
|---|---|---|---|---|---|
| Front cover | B (flattened PNG at publish) | front panel 612×869 of the 1252×869 wrap | published: `passport-pages` `{passport_id}/cover.png` (`okujiKobo/lib/explore/publish-images.tsx:30,148`); source upload: `design-assets` `{owner}/cover/{ts}.{ext}` (`okujiKobo/app/api/assets/upload/route.ts:177`) | `passports.cover_image_url` (`048:19-21`); composition `cover_outside_data` jsonb (`007:5`) | No (composited) |
| Spine | — | 28-unit gutter (`okujiKobo/lib/explore/svg/CoverSvg.tsx:15-17`) | — | — (transparent gutter, `print-pdf/route.tsx:545`) | n/a |
| Back cover | B | back panel (left 612) of the wrap | same `cover.png` | `cover_outside_data.back_bg` (`okujiKobo/lib/explore/svg/CoverSvg.tsx:36`) | No |
| Page background (procedural) | vector pattern (inline) | 612×869 | — (generated) | `passport_pages.background_type` guilloche/grid | Pattern stroked from `background_color` (`PageSvg.tsx:52-53,75-87`) |
| Page background (image) | B | 612×869 | `design-assets` `{owner}/background/{ts}.{ext}`; okuji presets static under `okujiKobo/public/presets/png/`; published `passport-pages` `{passport_id}/page-{order}.png` | `passport_pages.background_image_url` (`okujiKobo/supabase/migrations/019_page_background_image.sql:3`) | No (opacity only, `custom_background_opacity`) |
| Stamp art (emoji) | glyph | 1:1 | — | `stops.stamp_icon` | Tinted by `stamp_color` |
| Stamp art (custom) | A if SVG else B | 1:1, content-tight viewBox | `design-assets` `{owner}/stamp-{ts}.svg` (`okujiKobo/components/design/StampComposer/save.ts:44-51`) | `stops.stamp_asset_id` → `design_assets.url` | **Yes (SVG), from `stops.stamp_color`** |
| Back-cover QR | B (generated at print) | ~1in (169 units) | none (data-URI, not stored) | derived from `passports.is_okuji_official` | n/a — encodes `https://okuji.app` |

**Recolor pipeline (the one true recolor):** composer/uploaded stamp SVGs emit every fill/stroke as
the literal `currentColor`; consumers replace it with `#${stamp_color}` — print
(`okujiKobo/app/api/passports/[id]/print-pdf/route.tsx:1421-1425`), keepsake
(`okujiKobo/app/api/keepsake/route.tsx:387`), designer (`StampPreview.tsx:94,114-117`), react-pdf
(`okujiKobo/lib/design/stamp-composer/pdf-render.tsx:295-299`). Raster stamps are never re-inked
(`StampPreview.tsx:121-128`). `stamp_color` default `1D9E75` (hex without `#`).

> **OPEN QUESTIONS (images):**
> 1. **Custom SVG stamps are absent from the published marketplace/Explore PNG** — `PageSvg` /
>    `publish-images` carry only `stamp_icon` (emoji), not `stamp_asset_id`/`stamp_color`
>    (`okujiKobo/lib/explore/svg/PageSvg.tsx:41-49,255-287`; `publish-images.tsx:85-93`). Intended?
> 2. **No spine artwork/label slot** exists.
> 3. **"App icon" slot** requested in the brief has no passport-scoped equivalent (cover emblem is the
>    nearest; launcher icon lives in mobile build config, out of scope).
> 4. **`design_assets.asset_type` CHECK divergence:** baseline allows `('background','stamp','cover')`
>    (`okuji-db/.../000_baseline.sql:149-150`); `043` adds `'image'`; `kinds.ts` also uses `'layout'`
>    with no CHECK migration found adding it.

---

## 5. Color

Passport **design** colors are stored as hex strings **without** the leading `#`, at every level —
there is no single global palette row:

- **Per-passport (cover):** `cover_outside_data.front_bg` + `.back_bg` are the two cover-panel colors
  (`okujiKobo/lib/explore/svg/CoverSvg.tsx:35-36`), plus legacy `cover_bg_color` /
  `cover_paper_color` (`okuji-db/.../000_baseline.sql:86,93`).
- **Per-page — the "two-color page background" = `{paper_color, background_color}`:** the base paper
  rect is `paper_color` (default `F5F2EC`), the pattern ink is `background_color` (default `0D1B2A`),
  painted at `background_opacity` (procedural) / `custom_background_opacity` (image)
  (`okujiKobo/lib/explore/svg/PageSvg.tsx:52-53,92,95-100`; defaults `okuji-db/.../000_baseline.sql:134,136`).
- **Per-element:** text `color`, line `lineColor` inside `passport_pages.elements` jsonb
  (`okujiKobo/lib/design/types.ts:25,70,110`, default `0D1B2A`).
- **Per-stop:** `stamp_color` (default `1D9E75`) — the only field that drives SVG recolor (§4).

UI-chrome tokens (`okujiKobo/tailwind.config.ts:13-81`; cover paper-stock swatches
`stock.{forest,oxblood,navy,walnut,jet}` at `:54-61`) are **not** passport design data — the stored
values are plain text columns independent of Tailwind, though some defaults coincide (token
`green #1d9e75` == default `stamp_color 1D9E75`).

> **OPEN QUESTIONS (color):** `constants/Colors.ts` / `lib/colors.ts` (named in the brief) are **mobile**
> token files at the repo root, not web; web design-color tokens live only in `tailwind.config.ts`.
> `background_type 'landscape'` is permitted by the CHECK but has no render branch in `PageSvg` — likely
> legacy.

---

## 6. Text

- **Passport:** `title` NOT NULL (`okuji-db/.../000_baseline.sql:82`), `description` nullable (`:83`).
  **No passport-level subtitle** — subtitles are page-level.
- **Page:** `section_name`, `section_title`, `section_subtitle`, `prize_description`,
  `prize_location_constraint` (`okuji-db/.../000_baseline.sql:127-131`).
- **Stop:** `name` NOT NULL (`:168`), `address_street/city/state/zip` (`:169-172`), `country` (`042`),
  `learning_objective` (`:193`), `journal_prompt` (`:199`). **Stop `description` is absent web-side**
  — it exists only in the mobile base (`supabase/migrations/001_initial_schema.sql:101`). So the web
  designer has no free-text stop description field.
- **Page elements** (`passport_pages.elements` jsonb; union `DesignerPageElement`,
  `okujiKobo/lib/design/types.ts:125-132`; `PageElementType = 'text'|'richtext'|'image'|'layout'|'line'|'hline'|'vline'`, `:9`):
  `text` = single-line heading (`content?`, `:19-28`); `richtext` = multi-line **paragraph AND address
  block**, text in `runs: TextRun[]` (`:56-76`); `image`/`layout`/`line` carry no text. There is **no
  dedicated heading or address block type** — a heading is `text`, a paragraph/address is `richtext`.

**Length limits:** Zod is a dependency but **no `z.string().max()` validates passport/stop/page text**.
The only enforced limits are HTML `maxLength` on peripheral inputs — republish justification
`1000` (`okujiKobo/components/design/PublishFlow.tsx:691`), "what holders see" `200` (`:709`), stop ZIP
`20` (`okujiKobo/components/design/RightInspector.tsx:647`), emoji emblem `4`, hex colors `6`. **Core
content fields — title, description, section_*, stop name, addresses, learning_objective,
journal_prompt, element text — have NO enforced length limit (UI or schema).** The only publish-
checklist text rule is title must be non-empty and not `'Untitled Passport'`
(`okujiKobo/lib/design/publish-checklist.ts:113-114`).

**The 26px minimum: NOT enforced anywhere.** An exhaustive search found no ≥26 font-size floor. The
enforced minimums are `8` (page text `RightInspector.tsx:2008-2009`; richtext `:2380-2381`; cover text
`CoverInspector.tsx:160`) and `6` (stamp composer `ComposerInspector.tsx:356`). Default element sizes
are 13–16px. **If a 26px minimum is a product requirement, it is unimplemented.**

---

## 7. Print

Route `okujiKobo/app/api/passports/[id]/print-pdf/route.tsx` (Node runtime). Two modes selected by
`?format=trim` (`:1620`): default **home-printer booklet** (US-Letter 612×792 sheets, cut/stack/fold/
staple) and `?format=trim` **print-partner single leaf** (trim + 3mm bleed + crop marks).

How print differs from screen:
- **Physical scale:** screen renders raw 612×869 design units; print multiplies by a pt/unit scale
  (booklet `CANVAS_SCALE ≈ 0.4076`, `:98-99`; trim `PAGE_UNIT_TO_PT`, `:1108`). Dimensions from
  `okujiKobo/lib/print/passport-spec.ts` (88×125mm trim, 4mm spine, 3mm bleed, `:24-31,39-40`).
- **Fonts substituted** to the @react-pdf Helvetica family (`:283,310-313`).
- **Images pre-normalized** server-side with `sharp` (flatten alpha onto paper color, re-encode) —
  `okujiKobo/lib/print/normalize-images.ts:133-182`; SVG stamps rasterized at 324dpi via librsvg
  (`:130,247-263`). Failures drop the image to a blank slot, never throw (`:16-18`).
- **Imposition + bindery marks** exist only in print (cut/fold/staple guides, registration marks,
  "1. Cut / 2. Stack / 3. Fold / 4. Staple" strip at `:612-635`).
- **Stamps: blank boxes by default.** Print never reads the `stamps` table. `show_stamps` (default
  **off**, `:1249-1253`) optionally draws each stop's *designed* stamp preview; off → a blank box "for
  the collector to physically stamp into" (`:447-449,1121-1123`).
- **Marketing strip:** free passports only (`price_cents === 0`, `:1608-1610`) — a discardable strip
  with the okuji mark + `https://okuji.app`, cut off after assembly.
- **Back-cover QR:** `is_okuji_official` only (`:1612-1615`), encodes `https://okuji.app`, EC level H,
  1-inch, centered on the back panel (`:48-62,507-521,552-569`).

> **OPEN QUESTION (print):** the `?format=trim` partner export omits both the marketing strip and the
> back-cover QR (`PrintPassportTrimDoc`, `:1195-1214`). Intended or oversight?

---

## 8. Write path (how an automated agent should create a draft)

Every creation path and its implications:

| Path | Client / auth | RLS | Triggers on insert |
|---|---|---|---|
| **Seeder** `okujiKobo/scripts/seed-sample-passports.ts` | service-role key (`:137`) | **bypassed** | demo/official guards **exempt** (auth.uid() NULL); publish gate passes for drafts |
| `POST /api/design/create` (`okujiKobo/app/api/design/create/route.ts:46-63`) | SSR user session | yes — `creator_id = user.id` | same guards, but a real `auth.uid()` applies |
| `POST /api/passport_pages` (`okujiKobo/app/api/passport_pages/route.ts:206-210`) | user session | yes (`authorizePassportMutation`) | 12-page trial cap |
| designer stop insert (`okujiKobo/components/design/LeftPalette.tsx:322-324`) | browser user session | yes | 046 tier-sync |
| `POST /api/stops/import` (`okujiKobo/app/api/stops/import/route.ts`) | user session | yes (`creator_id = user.id`) | creates first page if none |

**No RPC / SECURITY DEFINER passport-creation function exists** (searched `.rpc(` / `.insert(` across
`app/` + `lib/`).

**RLS for INSERT** (latest: `okujiKobo/supabase/migrations/078_rls_initplan_auth_uid.sql`): all three
tables use `FOR ALL USING (…)` with **no separate `WITH CHECK`**, so Postgres reuses `USING` as the
insert check. `passports` insert allowed when `creator_id = auth.uid() OR is_admin() OR (proprietor
branch with can_design)` (`078:32-45`); `passport_pages`/`stops` allowed only under a passport owned
by the caller (`078:51-92`).

**Recommended path for a server-side agent: a service-role draft insert.** It bypasses RLS and, because
`auth.uid() IS NULL`, is exempt from the `is_demo`/`is_okuji_official` guards; a draft (`is_published`
false/omitted) passes `enforce_publish_gate` untouched. **Minimal valid chain** (from the generated
Insert types, `okujiKobo/lib/supabase/database.types.ts`):
`passports { creator_id, title }` → `passport_pages { passport_id, section_name }` →
`stops { page_id, name }`. `creator_id` must satisfy the FK to a real `profiles.id`.

What would block it: FK/NOT NULL (`creator_id` must be a real profile; page/stop parents must exist),
and inserting `is_published = true` under the service role (publish gate raises `42501` because a NULL
actor has no Studio-active profile). Set `status: 'draft'` explicitly (the column is nullable open
text — §1). Leave `verification_tier` unset (derived). To mint an **okuji-official** demo passport the
agent must either use the service role (exempt) or act as a platform admin — a normal user is blocked
by the guards.

> **OPEN QUESTIONS (write path):** `is_platform_admin()` behavior for a NULL actor is unverified
> (affects whether a service-role `is_published=true` is truly blocked); the base DDL for the three
> tables is not in the repo (minimal set inferred from the introspected Insert types).

---

## 9. Gaps — fields the designer agent will need that do not exist today

Verified **ABSENT** (checked `okuji-db/.../000_baseline.sql` passports `:78-115`, pages `:120-139`,
stops `:163-206`, `design_assets` `:144-158`, and `okujiKobo/lib/design/types.ts`):

- **Fun facts / trivia** (per stop or passport) — no `fun_fact`/`trivia`/`fact_*` column anywhere. Stops
  have only `learning_objective` + `journal_prompt` as free prose.
- **Structured palette on the passport** — none; colors live only per-element / per-surface / per-stop
  (§5). An agent choosing a coherent 2–3 color scheme has no single field to record intent.
- **Image source / attribution / license** on `design_assets` or `stops` — none (a generic
  `design_assets.metadata jsonb` exists but is untyped and unread for this;
  `stops.attribution_note` is stop-library authorship credit, not image licensing).
- **Fact source URLs / citations** — none anywhere.
- **Alt text for images** — none (`ImagePageElement` has only `imageUrl/rotation/opacity`,
  `okujiKobo/lib/design/types.ts:78-83`).
- **Difficulty / theme / category** — no `difficulty`/`theme`/`category` column. Closest existing:
  `passports.passport_type` (`location|experience|learning`), `traveler_types text[]`, stop
  `classifiers`/`grade_levels`/`subject_areas`.
- **Stop free-text description (web)** — absent web-side (§6); mobile-only.
- **Selection-criterion descriptor** — nothing records *why* a set of stops belongs together (needed
  by the broad-area agent below).

These gaps are **load-bearing for an automated designer**, not cosmetic: an agent that *selects*
places by a rule ("the capital of each country") and writes *factual* copy needs a fact field, a
citation/source-URL field, and a machine-readable statement of its selection rule — none of which
exist. (No migrations proposed here, per scope.)

---

## Worked example A — the Portland demo passport, in spec terms

Source: `okujiKobo/scripts/templates/portland.ts`, seeded by `okujiKobo/scripts/seed-sample-passports.ts`.

- **`passports` row:** `title = 'Every Direction · A Portland Passport'`, `description = 'I knew what
  was in every direction.'`, `passport_type = 'location'` (`portland.ts:24-38`). Seeder constants:
  `cover_emblem = '🌹'` (template `coverEmblem`), `cover_paper_color = 'F5F2EC'`,
  `cover_bg_color = '0D1B2A'`, `cover_template = 'guilloche_blue'`, `status = 'draft'`,
  `is_published = false` (template omits `isPublished`), `is_demo = false`, **`is_okuji_official = true`**
  (every seeded passport, `seed-sample-passports.ts:174-193`). No completion prize, no price →
  marketing strip **and** back-cover QR both print (free + okuji-official).
- **`passport_pages`:** 6 rows, `page_order` 0–5, `page_type = 'stamp'`, `section_title` = the page
  title, `section_subtitle` = null (Portland sets no subtitles), `elements = []`, `paper_color =
  'FFFFFF'`: `East · The Gorge` (6 stops), `South · The Valley` (4), `West · The Coast` (4),
  `North · St. Helens` (4), `Portland · The City` (5), `Hidden Gems` (5) — **28 stops total**
  (`portland.ts:42-105`).
- **`stops`:** all `kind: 'gps'` → `experience_type = 'location'`, `experience_verification_method =
  'gps'`, `verification_tier` derived = 3 (046 trigger). Each has `name`, `address_city`/`address_state`,
  `spend` tier, stamp defaults `stamp_icon '📍'` / `stamp_color '1D9E75'` / `stamp_type 'emoji'`.
  Most carry hand-entered `lat`/`lng` (e.g. `Multnomah Falls` 45.5762,-122.1158, `portland.ts:45`;
  `Powell's City of Books` 45.5232,-122.6815, `:91`); the three coastal towns (Seaside/Astoria/Long
  Beach) are coord-null for the designer's map picker (`:71-73`). No `place` fields → geocoder never
  runs. **No per-stop description/fact/image** (not expressible in the template; §2/§9).
- **Layout:** each stop needs `box_x/box_y/box_width/box_height` in 612×869 design units — but the
  template/seeder do **not** set them, so stops insert with box defaults and are positioned later in the
  designer (§3). **Open: the box_x percentage-vs-design-unit question (§3) applies to any backfilled row.**

## Worked example B — a broad-area "capital of each country" passport (Europe)

A second designer archetype: the region is the passport and the **selection rule is the point** — one
representative place per country. Per the agent's mandate: **one stop = each European country's capital
city.** Described strictly in existing fields:

- **`passports` row:** `title` e.g. `'Capitals of Europe'`, `description` = the selection rule stated
  plainly, `passport_type = 'location'`. A service-role draft insert (§8): `{ creator_id, title }`,
  `status = 'draft'`. `is_okuji_official` only if an official passport is intended (admin/service-role
  only).
- **`passport_pages`:** grouped by **geographic proximity / regional keyword** (per the chosen
  grouping), one page per cluster of nearby capitals — e.g. Nordic & Baltic; British Isles & Low
  Countries; Iberia & France; Central Europe; Italy & the Adriatic; Southeast Europe / Balkans; Eastern
  Europe. `section_title` = the cluster label. **Grouping is required, not optional**, because there is
  no max-stops-per-page guard (§3) and ~44 capitals on one page would overflow the 869-unit artboard;
  ~5–8 capitals per page keeps each within the auto-layout's ~24-box practical bound. The exact cluster
  set is a design choice.
- **`stops`:** one per capital. `name` = the city; `address_city` = the city, `address_country` /
  `country` = the nation. Coordinates via the template `place` field (e.g. `place: 'Paris, France'`)
  resolved by the seed-time geocoder (§2) — capitals geocode unambiguously by name. `kind: 'gps'`
  (capitals are far apart; GPS with a radius is the natural verification), so `experience_type =
  'location'`, `experience_verification_method = 'gps'`, tier derived. Box coords set in the designer or
  programmatically in 612×869 units.
- **Where it strains the schema (the gaps that matter, §9):** a capital almost always wants a one-line
  **fact** ("seat of the EU institutions") — **no stop description field web-side**; the agent's factual
  claims want a **source URL** — none exists; the passport wants to record its **selection criterion**
  ("capital city per country") machine-readably — none exists. These absences are what make §9's gaps
  load-bearing for this archetype rather than nice-to-have.

---

## 10. Agent output contract — what the agent synthesizes beyond the template

The template + seeder store only `name / address / lat / lng / spend / kind` per stop. Three things a
*ready-to-render* passport needs are **not** in that format and must be generated by the Designer
agent. All map onto existing columns — no migration required.

**(1) Per-stop box layout (§3).** Emit `box_x / box_y / box_width / box_height` in **612×869 design
units** (not percentages — §3 OQ1). A deterministic grid reusing the designer's own convention
(`okujiKobo/components/design/LeftPalette.tsx:330-333`): `box_x = 40 + (i % 4) * 130`,
`box_y = 40 + floor(i / 4) * 130`, `box_width = box_height = 120`. Keep ~5–8 stops/page (the auto-layout
runs off the 869-unit page after ~24 default boxes; there is no enforced max — §3). Without these, all
stops overlap at the default position (mobile `(0,0)`, web/print `(40,40)`).

**(2) Per-stop stamp (§4).** The flat default is `stamp_icon '📍'` / `stamp_color '1D9E75'` /
`stamp_type 'emoji'`. The agent should set these by inferred stop characteristic:
- **Tier A (works today, renders everywhere):** `stamp_type:'emoji'` + a characteristic `stamp_icon`
  emoji + a thematic `stamp_color` (hex without `#`).
- **Tier B (richer; has the Explore-render gap, §4 OQ1):** generate a monochrome `currentColor` SVG
  (`okujiKobo/lib/design/stamp-composer/svg.ts:12-16`), upload to the `design-assets` bucket, set
  `stamp_type:'custom_asset'` + `stamp_asset_id` + `stamp_color` (recolored at render from `stamp_color`).

**(3) Per-stop initial rotation.** The earned stamp should land **upright, randomly within ±45°**, the
angle chosen by RNG **at collection time, per collector** — not fixed at design time. The agent sets the
*range*; the placement RNG resolves the landing. Required fields:
- `stamp_rotation_fixed = NULL` so the random path runs rather than a fixed angle
  (`lib/stamp.ts:51-52`).
- **Mobile:** `stamp_rotation_range = 45` → placement computes
  `rotationDeg = (Math.random() * 2 - 1) * 45`, uniform in `[-45, 45]` (`lib/stamp.ts:54-55`).
- **Web/baseline:** `stamp_rotation_min = -45`, `stamp_rotation_max = 45`
  (`okuji-db/supabase/migrations/000_baseline.sql:185-186`).
- Leave the **box** rotation `stops.rotation = 0` (`okujiKobo/supabase/migrations/024_stop_rotation.sql:3`)
  so the stamp *impression* tilts while the frame stays upright.
- The landed angle is stored **per collector** in `stamps.rotation_deg`
  (`supabase/migrations/001_initial_schema.sql:149`), written from `placement.rotationDeg`
  (`lib/stamp.ts:95`).

> **CAVEAT:** the primary in-book gesture placement derives rotation from the finger's initial drift
> (falling back to ±4° jitter), and `stamp_rotation_fixed` still wins
> (`components/stamp/StampGestureInteraction.tsx:184-227`). So the ±45 range governs the
> helper / non-gesture path with certainty; whether it governs the gesture path is an open question
> (below). Setting the range is correct either way; the agent cannot assume every earned stamp lands
> strictly via `(Math.random()*2-1)*45`.

---

## Consolidated open questions

1. `passports.status` physical origin and whether it is truly unconstrained nullable text in prod
   (live type `string | null`, `database.types.ts:1506`; baseline's 3-value CHECK is non-authoritative;
   code writes a 4th value `'custodial'`, `049:221`). Contradicts CLAUDE.md §9. **Needs live DB
   introspection.**
2. Missing `okujiKobo/supabase/migrations/002_designer_schema.sql` — the true base web DDL for
   `institutions` and the web `stops`/`passports` column set is not in the repo (`002_connect_schema.sql:2`).
3. `proprietor_id` FK target conflict: mobile → `proprietors(id)` (`001:51`) vs web/baseline →
   `institutions(id)` (`002:39`). Which is live? Is `proprietors` superseded?
4. Duplicated geo/verification columns on one `public.stops` (`target_location`/`radius_meters`/
   `qr_code_id` vs `lat`/`lng`/`verification_radius_meters`/`qr_code_token`). Which are authoritative at
   runtime? (046 makes `experience_*` canonical + `verification_tier` derived, but radius/qr pairs have
   no documented reconciliation.)
5. `box_x/box_y` units — migration-007 percentage comment/backfill vs all-renderer design-unit
   treatment (§3). A designer agent should write design units; confirm.
6. `box_width`/`box_height` default `40/30` (mobile 007) vs `120/120` (baseline).
7. `institution_id` and `cover_thumbnail_url` on `passports` appear in the introspected types with no
   traceable migration (`database.types.ts:1478,1457`).
8. Types snapshot lag — `database.types.ts` omits `is_okuji_official`/`punch_*`/`completion_required_stops`.
9. Custom SVG stamps absent from the published Explore PNG (§4); Explore holder-view stamps not
   recolored.
10. No spine artwork/label slot; "app icon" has no passport-scoped slot (§4).
11. 26px minimum font size is **not implemented** anywhere (§6) — confirm whether it is a requirement.
12. `?format=trim` print export drops marketing strip + back-cover QR (§7).
13. The brief said "10 city templates"; the repo has **5** (`okujiKobo/scripts/templates/`).
14. `is_platform_admin()` behavior for a NULL actor (service role) is unverified (§8).
15. Stamp-rotation field divergence: mobile stores `stamp_rotation_range` (symmetric ±, default 5,
    `supabase/migrations/001_initial_schema.sql:114`) while web/baseline stores
    `stamp_rotation_min`/`stamp_rotation_max` (default -15/15, `okuji-db/.../000_baseline.sql:185-186`).
    Same mobile-vs-web column duplication as the geo fields (§0). Which is authoritative on the live
    `public.stops`, and must the agent write both representations? (§10)
16. Gesture-path rotation override: the in-book gesture placement derives rotation from finger motion
    and may not honor the stop's rotation range
    (`components/stamp/StampGestureInteraction.tsx:184-227`). Confirm whether widening the range to
    ±45 actually changes the earned-stamp rotation in the gesture flow, or only in the helper path. (§10)
