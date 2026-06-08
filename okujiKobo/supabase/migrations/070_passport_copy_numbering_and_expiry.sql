-- Migration 070: passport per-copy serial + optional expiry — design-side (M2 follow-up)
--
-- Web-tree migration. Hosts the passport-level columns and the
-- atomic allocator function. The companion mobile-tree migration
-- 019 adds collector_passports.copy_number + .expires_at, and
-- the ensure_collector_passport function that calls
-- allocate_copy_number.
--
-- DEPLOY ORDER: this runs FIRST. Mobile 019's
-- ensure_collector_passport function references
-- allocate_copy_number and the passports columns added here.
--
-- ADDED COLUMNS
--
--   passports.next_copy_number      int  NOT NULL DEFAULT 1
--     Per-passport counter. The Nth holder of a given passport
--     gets number (next_copy_number - 1) at the moment of
--     acquisition; the column then increments. Gap-tolerant by
--     design — if an acquisition rolls back after allocation,
--     the number is skipped. Simpler and safe; gap-free
--     enforcement would require holding longer locks for no
--     real benefit at our acquisition rate.
--
--   passports.expiry_duration_days  int  NULL
--     Designer-set expiry duration for this passport's copies.
--     NULL = copies never expire (the default for every
--     existing passport — additive). Set at the design level;
--     stored on the copy as a concrete expires_at so changes
--     to the design's duration NEVER retroactively expire
--     existing copies.
--
--   passports.show_copy_number      bool NOT NULL DEFAULT false
--     Opt-in toggle. When true, the holder's copy number
--     resolves into any {{copy_number}} token a designer
--     places in a page text element. Defaults to false so the
--     feature is invisible until a designer explicitly turns
--     it on.
--
-- BACKFILL — required for safe replay against a non-empty DB
--
--   With zero users today, no rows exist; the backfill is a
--   no-op. Included so that a future re-run of this migration
--   against a DB that somehow already had collector_passports
--   rows would land sensible counter values rather than the
--   default 1 (which would collide with any existing
--   collector_passports.copy_number assignments after mobile
--   019 runs).
--
-- ATOMIC ALLOCATOR
--
--   allocate_copy_number(p_passport_id uuid) returns integer
--   SECURITY DEFINER. Atomically increments next_copy_number
--   and returns the value just allocated. Postgres row-lock on
--   the passport row serializes concurrent allocators — two
--   simultaneous acquisitions of the same passport receive
--   distinct numbers, never the same. Raises if the passport
--   does not exist.
--
-- ROLLBACK: DROP FUNCTION allocate_copy_number(uuid). DROP
-- the three columns. Mobile 019 + the mirror-insert code paths
-- must roll back first.

-- ─── Columns ────────────────────────────────────────────────────
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS next_copy_number    integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expiry_duration_days integer NULL,
  ADD COLUMN IF NOT EXISTS show_copy_number    boolean NOT NULL DEFAULT false;

ALTER TABLE public.passports
  DROP CONSTRAINT IF EXISTS passports_expiry_duration_check;
ALTER TABLE public.passports
  ADD CONSTRAINT passports_expiry_duration_check
  CHECK (expiry_duration_days IS NULL OR expiry_duration_days > 0);

-- ─── Backfill — safe replay support ─────────────────────────────
-- Set next_copy_number to (existing copy count + 1) for every
-- passport. With zero users this updates nothing meaningful; with
-- existing data it ensures future allocations don't collide with
-- any pre-existing collector_passports.copy_number values mobile
-- 019 may have set.
UPDATE public.passports p
   SET next_copy_number = sub.next_n
  FROM (
    SELECT passport_id, COUNT(*)::int + 1 AS next_n
      FROM public.collector_passports
     GROUP BY passport_id
  ) AS sub
 WHERE p.id = sub.passport_id;

-- ─── Atomic allocator ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.allocate_copy_number(p_passport_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allocated integer;
BEGIN
  -- The UPDATE takes a ROW EXCLUSIVE lock on the passport row,
  -- serializing concurrent allocators. RETURNING gives back the
  -- post-increment value; we subtract 1 to return the number
  -- this caller actually receives.
  UPDATE public.passports
     SET next_copy_number = next_copy_number + 1
   WHERE id = p_passport_id
  RETURNING next_copy_number - 1
    INTO v_allocated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passport not found: %', p_passport_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_allocated;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_copy_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_copy_number(uuid) TO authenticated;
