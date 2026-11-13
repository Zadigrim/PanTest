<#
.SYNOPSIS
  Load a built okuji passport (stamps, pages, cover, stops) into Supabase.

.DESCRIPTION
  Runs the SQL in generated/<code>/ against the database in $env:SUPABASE_DB_URL:
    1. 00_preflight.sql   read only. Stops if any column, the creator profile or
                          extensions.uuid_generate_v5 is missing, or if a passport
                          with the same title exists under a different id.
    2. 01..07             one transaction: helpers, passport + pages, stops, stamps,
                          page backgrounds, cover, drop helpers. Any error rolls
                          everything back, helpers included.
    3. 08_verify.sql      reads the passport back.
  If the passport already exists the script stops unless you pass -Update, in which
  case the content is updated in place (uuid5 ids). Status, price and ownership are
  never changed by a rerun.

.EXAMPLE
  $env:SUPABASE_DB_URL = 'postgresql://postgres.nofmiruervhxaajrivdi:YOUR-PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require'
  .\load-passport.ps1 -Code ber -PreflightOnly
  .\load-passport.ps1 -Code ber
#>
param(
  [string]$Code = 'ber',
  [string]$DbUrl = $env:SUPABASE_DB_URL,
  [switch]$PreflightOnly,
  [switch]$Update
)

$ErrorActionPreference = 'Continue'
$env:PGCLIENTENCODING = 'UTF8'          # the SQL files are UTF-8; Windows psql defaults to WIN1252
$dir = Join-Path $PSScriptRoot "generated\$Code"

function Fail($msg) { Write-Host "STOPPED: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Fail "psql not found. Install the PostgreSQL client (for example: winget install PostgreSQL.PostgreSQL.17), then add its bin folder (C:\Program Files\PostgreSQL\17\bin) to PATH and open a new PowerShell window."
}
if (-not $DbUrl) { Fail "Set `$env:SUPABASE_DB_URL to the Session pooler connection string from Supabase (Connect button), with your database password filled in." }
if (-not (Test-Path $dir)) { Fail "No SQL found at $dir. Run: python build_stamps.py berlin; python build_sql.py berlin" }

$files = @('00_preflight.sql','01_helpers.sql','02_passport_and_pages.sql','03_stops.sql','04_stamps.sql',
           '05_page_backgrounds.sql','06_cover.sql','07_drop_helpers.sql','08_verify.sql')
foreach ($f in $files) { if (-not (Test-Path (Join-Path $dir $f))) { Fail "Missing $f in $dir" } }

# ---- 1. preflight (read only) ----
Write-Host "Preflight for '$Code'..." -ForegroundColor Cyan
$out = & psql $DbUrl -X -q -t -A -v ON_ERROR_STOP=1 -f (Join-Path $dir '00_preflight.sql') 2>&1
$code1 = $LASTEXITCODE
$out | ForEach-Object { Write-Host "  $_" }
if ($code1 -ne 0) { Fail "Preflight failed. Nothing was written." }
$already = (($out | Where-Object { "$_" -match '^[tf]$' }) | Select-Object -Last 1)
if ($already -eq 't' -and -not $Update) {
  Fail "This passport is already in Supabase. Nothing was written. Rerun with -Update to refresh its content in place."
}
if ($PreflightOnly) { Write-Host "Preflight passed. -PreflightOnly set, so nothing was written." -ForegroundColor Green; exit 0 }

# ---- 2. load, one transaction ----
Write-Host "Loading (single transaction)..." -ForegroundColor Cyan
$loadArgs = @($DbUrl, '-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1', '-o', 'NUL')
foreach ($f in $files[1..7]) { $loadArgs += @('-f', (Join-Path $dir $f)) }
& psql @loadArgs 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) { Fail "Load failed and was rolled back. Nothing was written." }

# ---- 3. verify ----
Write-Host "Verifying..." -ForegroundColor Cyan
& psql $DbUrl -X -x -f (Join-Path $dir '08_verify.sql')
if ($LASTEXITCODE -ne 0) { Fail "Verify query failed (the load itself committed)." }
Write-Host "Done. Every *_ok / every_* / cover_has_image / flags_ok value above should be t, and leftover_tmp_helpers 0." -ForegroundColor Green
Write-Host "Design area: https://okujikobo.okuji.app/design"
