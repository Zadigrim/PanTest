# Database Migrations

Migrations live in `supabase/migrations/` and are applied in numeric order.
Run them against your local Supabase instance with:

```bash
supabase db push
# or for a remote project:
supabase db push --linked
```

---

## 015 — Pricing Model (2026-05-08)

**File:** `supabase/migrations/015_pricing_model.sql`

Adds server-side pricing model tracking fields to `institutions`:

| Column | Type | Notes |
|---|---|---|
| `municipality_population` | `integer` | Population used to determine free vs community tier for municipalities |
| `pricing_model_locked` | `boolean DEFAULT false` | When true, auto-recomputation is skipped; admin override is in effect |
| `pricing_model_override_by` | `uuid → profiles` | Platform admin who applied the manual override |
| `pricing_model_override_at` | `timestamptz` | Timestamp of the last manual override |
| `pricing_model_computed` | `text` | Last auto-computed pricing model (for auditing) |

Also expands the `pricing_model` CHECK constraint to include `'patron'`, and
expands the `institution_type` CHECK constraint to include all canonical types
introduced in this cycle plus legacy aliases.

Pricing logic lives in `lib/pricing.ts` — never duplicate it elsewhere.

---

## 014 — Block Point 6

**File:** `supabase/migrations/014_blockpoint6.sql`

---

## 013 — Block Point 5

**File:** `supabase/migrations/013_blockpoint5.sql`

---

## 012 — Block Point 4

**File:** `supabase/migrations/012_blockpoint4.sql`

---

## 011 — Block Point 3

**File:** `supabase/migrations/011_blockpoint3.sql`

---

## 010 — Block Point 2

**File:** `supabase/migrations/010_blockpoint2.sql`

---

## 009 — Block Point 1

**File:** `supabase/migrations/009_blockpoint1.sql`

---

## 008 — Storage Buckets

**File:** `supabase/migrations/008_storage_buckets.sql`

---

## 007 — Cover Data

**File:** `supabase/migrations/007_cover_data.sql`

---

## 006 — Design Assets

**File:** `supabase/migrations/006_design_assets.sql`

---

## 005 — Print for Kids

**File:** `supabase/migrations/005_print_for_kids.sql`

---

## 004 — Classifiers & Roles

**File:** `supabase/migrations/004_classifiers_roles.sql`

---

## 002 — Connect Schema

**File:** `supabase/migrations/002_connect_schema.sql`
