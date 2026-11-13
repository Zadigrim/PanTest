# okuji city passport pipeline

Builds the art (stamps, page backgrounds, cover wrap) and the loader SQL for
okuji-official city passports, and loads them into Supabase as drafts.

Source: the project doc `claude/passport-pipeline.md`. This folder holds the
Berlin build only. Munich and Stockholm have motifs and cover colors in the doc
but no content files (stop lists), so they cannot be built yet.

Every passport loads as `status = draft`, `is_demo`, `is_okuji_official`,
`is_free`, `price_cents = 0`, owned by Nathan's creator profile
(`921b40f1-7111-466e-8ed7-7f69430e465a`), so it shows in the okujiKobo design
area. Ids are uuid5 in namespace `3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55`, so a
rerun updates rows in place instead of duplicating them.

## Rebuild (Python 3, Linux or macOS; needs DejaVu fonts)

```
pip install cairosvg opencv-python-headless shapely fonttools numpy pillow
python build_stamps.py berlin     # generated/stamps.json + generated/berlin_stamps.png contact sheet
python build_sql.py berlin        # generated/ber/00..08 *.sql
```

`generated/berlin_pages.png` and `generated/berlin_cover.png` are review renders.

## Load (Windows PowerShell)

Needs the PostgreSQL client (`psql`) on PATH and the Session pooler connection
string from the Supabase Connect button. Do not commit the connection string.

```
cd okujiKobo\scripts\passport-pipeline
$env:SUPABASE_DB_URL = 'postgresql://postgres.nofmiruervhxaajrivdi:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require'
.\load-passport.ps1 -Code ber -PreflightOnly    # read only
.\load-passport.ps1 -Code ber                    # load + verify
.\load-passport.ps1 -Code ber -Update            # rerun over an existing load
```

## Changes from the doc's gen2.py

- Stamp calls use `_okuji_tmp_stamp` (the doc called the undefined `_okuji_tmp_s`).
- Info pages are numbered from `len(PAGES)+1`, not hard-coded 8 to 11.
- Stops no longer write `verification_tier`; the migration-046 trigger derives it
  (CLAUDE.md invariant 5).
- Passport, page and stop inserts are `ON CONFLICT (id) DO UPDATE`. A rerun never
  changes status, is_published, price or ownership.
- The temporary `_okuji_tmp_*` functions are created and dropped inside the load
  transaction.
- `passports.country` needed migration 109.

## Known art nit

On the shield, oval and octagon stamps the ends of the lower name-band rule cross
the thin inner frame line. Present in the doc's design; left as is.
