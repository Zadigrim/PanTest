# okuji — iOS App Store submission guide

Status: **In-repo iOS config landed** (export-compliance flag, privacy
manifest, EAS iOS build profiles — branch `claude/confident-mendel-7mt276`).
Everything below is work that **Claude Code cannot do** because it
requires your Apple account, a paid membership, real devices, or a
legal-entity decision. This is the ordered punch-list Nathan runs.

> **Scope reminder.** This guide documents *account/portal* actions
> only. No step here edits the repo. The bundle identifier
> `com.okuji.app` is already set (`app.json`) and matches Android — do
> not change it; the App Store Connect record must use that exact id.

> **Anti-steering — load-bearing, do not regress.** okuji.app is the
> store; the app sells nothing and must never show or link to checkout,
> upgrade, pricing, or "buy" UI. This is what keeps the app on the right
> side of Apple's anti-steering / reader-app rules. If a future change
> adds any purchase or external-purchase link to the mobile binary, the
> submission posture in this guide no longer applies.

---

## 0. Decide the legal entity — **BLOCKED ON INCORPORATION**

Before enrolling in the Apple Developer Program you must choose the
account holder. This is the one decision that is painful to reverse, so
make it deliberately.

| Option | Implication |
| ------ | ----------- |
| **Individual** (you, personally) | Fastest to enroll; seller name shows as your legal name; account is tied to you personally. |
| **Organization — Shuin PBC** (recommended target) | Requires the PBC to exist: legal entity, a **D-U-N-S number** (free from Dun & Bradstreet, can take 1–2+ weeks), and authority to bind the entity. Seller name shows as "Shuin" (or the registered org name). This is the correct long-term home — marks/patents/codebase live in Shuin. |

**Transferring an app from an Individual account to an Organization
account later is possible but disruptive** (app transfer has eligibility
rules, breaks some continuity, and can't always carry everything). If
incorporation is close, prefer waiting and enrolling as the
organization. If you must ship before the PBC exists, enroll as an
individual and plan a transfer — but know the cost.

**Action:** decide individual vs Shuin PBC. If PBC: start the D-U-N-S
lookup/request now (it gates enrollment). Everything below assumes the
entity decision is made.

---

## 1. Apple Developer Program enrollment — **$99/yr, your Apple ID**

- **What:** A paid Apple Developer Program membership. Required to ship
  to TestFlight or the App Store.
- **Where:** <https://developer.apple.com/programs/enroll/>
- **Why:** Without it you cannot create App Store Connect records,
  distribution certificates, or submit builds.
- **Notes:** Use an Apple ID with two-factor auth that you control
  long-term (not a personal throwaway). For the org path, enrollment
  asks for the D-U-N-S number and legal entity details and Apple
  verifies them (can add days). **Blocked on §0 if going the PBC route.**

---

## 2. Create the App Store Connect app record — **your account**

- **What:** The app's record in App Store Connect.
- **Where:** <https://appstoreconnect.apple.com> → My Apps → "+".
- **Why:** TestFlight and submission both attach to this record.
- **Fields:**
  - **Bundle ID:** must be `com.okuji.app` (register it under
    Certificates, Identifiers & Profiles first if it isn't there; it is
    the same id already in `app.json`).
  - **Name:** "okuji" (lowercase brand; check availability — App Store
    names are globally unique).
  - **Primary language**, **SKU** (internal string, e.g. `okuji-ios`),
    **user access** as you like.
- **Notes:** The marketing/seller name surfaces publicly — that's the
  §0 entity name, not "Shuin" if you went individual.

---

## 3. Certificates & provisioning — **mostly EAS-managed**

- **What EAS manages for you:** With the iOS production profile now in
  `eas.json`, `eas build --platform ios --profile production` will, on
  first run, offer to **generate and store your iOS Distribution
  certificate and an App Store provisioning profile** in your Apple
  account (you log in / supply an App Store Connect API key). You do not
  hand-manage `.p12`/`.mobileprovision` files.
- **What you provide:** Apple Developer login (or an **App Store Connect
  API key** — recommended for CI: App Store Connect → Users and Access →
  Integrations → App Store Connect API → generate a key with App Manager
  role; download the `.p8` **once**). EAS stores credentials server-side.
- **Where:** driven by the EAS CLI prompts; key generation in App Store
  Connect.
- **Why:** Apple requires a distribution-signed binary; EAS automates
  the signing once it can authenticate as you.
- **Simulator builds** (`development`/`preview` profiles → `simulator:
  true`) need **no** Apple credentials — useful for local testing before
  you enroll.

---

## 4. App Privacy "nutrition labels" — **your account, must match the manifest**

- **What:** The App Privacy questionnaire on the app record.
- **Where:** App Store Connect → your app → App Privacy.
- **Why:** Required before submission; must be consistent with the
  in-repo `privacyManifests` (`app.json`) or you risk rejection /
  removal for an inaccurate label.
- **Answer it to match the minimal-collection posture:**
  - **Tracking:** **No** — the app does not track. (Manifest:
    `NSPrivacyTracking = false`, no tracking domains.)
  - **Data collected → Location → Coarse Location:** declare it, linked
    to **App Functionality only**, **not** linked to the user's
    identity, **not** used for tracking. (Matches the manifest: geohash
    precision-6 ≈ 1 km cells, foreground-only, used to find nearby
    passports, not stored.)
  - **Everything else:** No collection — no contacts, no identifiers for
    tracking, no analytics-for-tracking. Camera / microphone / photos
    are **device permissions for on-device features**, not data
    collected off-device, so they are not "data collection" entries
    unless content is uploaded; journal photos/audio that sync are
    user content (declare "User Content" only if/as it is actually
    transmitted and retained — confirm against the journal sync path
    before ticking it).
- **Notes:** If you later store location or add analytics, both the
  manifest **and** this label must change together.

---

## 5. Content / age rating — **your account**

- **What:** Apple's age-rating questionnaire.
- **Where:** App Store Connect → your app → Age Rating.
- **Why:** Required for submission.
- **Answer:** the app has no objectionable content; expect a low rating
  (4+ / 9+). Note that collectors can create **user-generated content**
  (journal entries, stamp icons) — answer the UGC questions honestly
  (moderation/reporting posture) so the rating and review reflect it.

---

## 6. Export compliance — **already answered in-repo, confirm in portal**

- **What:** The encryption-usage declaration.
- **In repo:** `app.json` sets `ITSAppUsesNonExemptEncryption: false`
  (standard HTTPS only → exempt), so per-build prompts are pre-answered.
- **Where / why:** App Store Connect may still surface a one-time
  confirmation; answer that the app uses only **standard/exempt
  encryption (HTTPS)** and is **not** subject to additional export
  documentation. No CCATS / year-end self-classification report is
  needed for exempt HTTPS use.

---

## 7. Real-device screenshots — **TestFlight, do NOT fabricate**

- **What:** Required App Store screenshots at Apple's current required
  sizes (at minimum the 6.7"/6.9" iPhone class; iPad if you keep
  `supportsTablet: true` — which is set).
- **Where:** capture from the app running on a real device (or
  simulator at the right resolution) installed via TestFlight; upload
  under the app record's localization.
- **Why / rule:** screenshots must depict actual in-app UI. **Do not
  mock up, fabricate, or composite screens that don't exist.** Capture
  the real passport/collection/journal surfaces.
- **Notes:** because `supportsTablet` is true, Apple will expect iPad
  screenshots too — either provide them or set the app to iPhone-only
  before submission (an iPhone-only change is a binary/config change and
  is out of scope for this guide; flag it if you want it).

---

## 8. App Review notes & demo account — **your account**

- **What:** Notes to the reviewer + a working demo login.
- **Where:** App Store Connect → your app → the version → App Review
  Information.
- **Why:** the app is account-gated; review **will** be blocked without
  a credential that reaches the real experience.
- **Provide:**
  - A **demo account** (email + password) seeded with at least one
    acquired passport so the reviewer sees stamping/collection, not an
    empty state.
  - A note explaining **location is foreground-only and ephemeral**
    (used at the moment of stamping to find nearby passports, never
    background, never stored) — pre-empts the common location-rejection.
  - A note that **the app sells nothing**; purchases/upgrades happen on
    the web (okuji.app), and the app contains no purchase UI — pre-empts
    anti-steering questions.

---

## 9. TestFlight → submission sequence — **your account**

Ordered, end to end:

1. **Build:** `eas build --platform ios --profile production` (first run
   sets up credentials per §3). Produces an `.ipa`.
2. **Upload to TestFlight:** `eas submit --platform ios` (or let EAS
   upload), targeting the §2 app record. Requires the App Store Connect
   API key from §3.
3. **Export compliance** prompt on the build — answer exempt (§6) if
   asked despite the in-repo flag.
4. **Internal TestFlight testing:** install on your own device(s),
   verify the real UI (this is the gate — *build-green ≠ shipped*).
   Capture §7 screenshots here.
5. **Complete the version page:** description, keywords, support URL,
   **privacy policy URL** (`https://okuji.app/privacy.html` — already
   hosted), screenshots (§7), age rating (§5), App Privacy (§4), review
   notes + demo account (§8).
6. **Submit for review.** Choose manual or automatic release.
7. **Respond to review** if Apple asks questions (location, account
   deletion, anti-steering — answers are pre-staged in §8). In-app
   account deletion already ships (`close_user_account`), satisfying
   Apple's deletion requirement — point the reviewer to Profile →
   Delete Account if asked.

---

## Items blocked on incorporation

| Item | Blocked? | Why |
| ---- | -------- | --- |
| §0 entity decision | **YES** | Is the decision. |
| §1 enrollment (org path) | **YES** | Needs PBC + D-U-N-S. |
| §1 enrollment (individual path) | No | Can proceed today; transfer later (costly). |
| §2–§9 | No (once enrolled) | Depend only on an active membership. |

**Recommendation:** if Shuin PBC incorporation is near, start the
D-U-N-S request now and enroll as the organization — it avoids the
app-transfer pain. If you need to validate the iOS build pipeline before
then, use the `simulator` profiles (§3), which need no Apple account at
all.
