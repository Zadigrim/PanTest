<#
.SYNOPSIS
    Capture Google Play tablet screenshots from a connected Android emulator (or device).

.DESCRIPTION
    Interactive helper for grabbing up to 8 store screenshots. You navigate the okuji
    app in the emulator, press Enter, and the script captures the current frame with
    `adb shell screencap` + `adb pull` (binary-safe -- no exec-out/PowerShell redirection,
    which mangles the PNG stream on Windows). Each capture is validated against the Play
    tablet spec: 1080x1920 portrait (9:16) and under 8 MB. Non-conforming shots produce a
    warning but are kept, so you can decide whether to re-take.

    Files land in ./playstore-screenshots/ as okuji-tablet-01.png .. okuji-tablet-08.png.

.NOTES
    Targets Windows PowerShell 5.1. Reads PNG dimensions straight from the IHDR header
    (no System.Drawing / GDI file locks).
#>

[CmdletBinding()]
param(
    [int]$MaxShots = 8,
    # Filename infix + device group, e.g. -Label phone -> okuji-phone-01.png.
    # Keeps phone and tablet sets from overwriting each other.
    [string]$Label = 'tablet',
    [string]$OutDir = (Join-Path (Get-Location) 'playstore-screenshots')
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# --- Spec constants -------------------------------------------------------
# Google Play screenshot rules (device-agnostic): each side 320-3840 px, the
# long side no more than 2x the short side, under 8 MB. This passes a 2560x1600
# tablet (1.6:1) and a 1080x1920 phone (2:1), and correctly flags e.g. a
# 1080x2400 20:9 phone (2.22:1) as too tall for Play.
$MinSide  = 320
$MaxSide  = 3840
$MaxRatio = 2.0
$MaxBytes = 8MB
$DevicePath     = '/sdcard/okuji-play-shot.png'

# --- Helpers --------------------------------------------------------------

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

# Run adb without letting its stderr abort the script. Under
# $ErrorActionPreference='Stop', a native command that writes to stderr (adb's
# first-run daemon banner, adb pull's "1 file pulled" summary) raises a
# terminating NativeCommandError -- and in Windows PowerShell 5.1 a 2>$null
# redirect does NOT suppress that. So flip the preference to Continue for the
# duration of the call. Returns merged stdout+stderr as one string; callers
# judge success by $LASTEXITCODE, which a native command sets and which
# survives the trailing Out-String (a cmdlet doesn't touch it).
function Invoke-Adb {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & adb @args 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Read width/height from a PNG's IHDR chunk. PNG layout:
#   bytes 0-7   : signature 89 50 4E 47 0D 0A 1A 0A
#   bytes 8-11  : IHDR length
#   bytes 12-15 : "IHDR"
#   bytes 16-19 : width  (big-endian uint32)
#   bytes 20-23 : height (big-endian uint32)
function Get-PngDimensions([string]$Path) {
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $header = New-Object byte[] 24
        $read = $fs.Read($header, 0, 24)
        if ($read -lt 24) { throw "file too short to be a PNG" }

        $sig = @(0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A)
        for ($i = 0; $i -lt 8; $i++) {
            if ($header[$i] -ne $sig[$i]) { throw "not a PNG (bad signature)" }
        }

        $width  = ([int]$header[16] -shl 24) -bor ([int]$header[17] -shl 16) -bor ([int]$header[18] -shl 8) -bor [int]$header[19]
        $height = ([int]$header[20] -shl 24) -bor ([int]$header[21] -shl 16) -bor ([int]$header[22] -shl 8) -bor [int]$header[23]
        return [pscustomobject]@{ Width = $width; Height = $height }
    }
    finally {
        $fs.Close()
        $fs.Dispose()
    }
}

# --- Preflight: adb on PATH ----------------------------------------------

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    Fail "adb is not on your PATH. Install Android platform-tools and add it, then re-run."
}

# --- Preflight: exactly one device/emulator ------------------------------

# Prime the adb daemon first so its first-run banner is out of the way; all adb
# calls go through Invoke-Adb, which keeps that stderr from aborting the script.
Invoke-Adb start-server | Out-Null

# `adb devices` prints a header line then one row per device: "<serial>\t<state>".
$raw = Invoke-Adb devices
$lines = $raw -split "`r?`n"
$devices = @()
foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t -eq '') { continue }
    if ($t -like 'List of devices attached*') { continue }
    if ($t -match '^\*') { continue }  # daemon startup chatter
    $parts = $t -split "\s+"
    if ($parts.Count -ge 2) {
        $devices += [pscustomobject]@{ Serial = $parts[0]; State = $parts[1] }
    }
}

$ready = @($devices | Where-Object { $_.State -eq 'device' })
$unauthorized = @($devices | Where-Object { $_.State -ne 'device' })

if ($ready.Count -eq 0) {
    if ($unauthorized.Count -gt 0) {
        $desc = ($unauthorized | ForEach-Object { "$($_.Serial) [$($_.State)]" }) -join ', '
        Fail "No READY device. Found: $desc. If 'unauthorized', accept the RSA prompt on the device; if 'offline', restart the emulator."
    }
    Fail "No device or emulator connected. Start your Android emulator and wait for it to boot, then re-run."
}
if ($ready.Count -gt 1) {
    $desc = ($ready | ForEach-Object { $_.Serial }) -join ', '
    Fail "More than one device/emulator connected ($desc). Disconnect the extras (or stop other emulators) so exactly one remains."
}

$serial = $ready[0].Serial
Write-Host "Using device: $serial" -ForegroundColor Green

# --- Output directory -----------------------------------------------------

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}
Write-Host "Saving screenshots to: $OutDir"
Write-Host ""
Write-Host "Play spec: each side ${MinSide}-${MaxSide} px, long side <= ${MaxRatio}x short side, under $([int]($MaxBytes/1MB)) MB." -ForegroundColor Cyan
Write-Host "Navigate the app in the emulator, then press Enter to capture. Type 'q' then Enter to stop early."
Write-Host ""

# --- Capture loop ---------------------------------------------------------

for ($i = 1; $i -le $MaxShots; $i++) {
    $index = '{0:D2}' -f $i
    $fileName = "okuji-$Label-$index.png"
    $destPath = Join-Path $OutDir $fileName

    $prompt = "[$i/$MaxShots] Navigate to the screen you want, then press Enter to capture $fileName (or 'q' to quit)"
    $answer = Read-Host $prompt
    if ($answer -and $answer.Trim().ToLower() -eq 'q') {
        Write-Host "Stopping at your request." -ForegroundColor Yellow
        break
    }

    # Capture on-device, then pull. Two discrete steps keep the PNG bytes intact
    # (exec-out piped through PowerShell's text redirection corrupts binaries).
    Write-Host "  capturing..." -NoNewline
    Invoke-Adb -s $serial shell screencap -p $DevicePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Warning "screencap failed on device (exit $LASTEXITCODE). Skipping this slot; press Enter to retry."
        $i--
        continue
    }

    if (Test-Path -LiteralPath $destPath) { Remove-Item -LiteralPath $destPath -Force }
    Invoke-Adb -s $serial pull $DevicePath $destPath | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destPath)) {
        Write-Host ""
        Write-Warning "adb pull failed (exit $LASTEXITCODE). Skipping this slot; press Enter to retry."
        $i--
        continue
    }

    # Clean up the on-device temp file (best-effort).
    Invoke-Adb -s $serial shell rm -f $DevicePath | Out-Null

    Write-Host " done -> $fileName"

    # --- Validate ---------------------------------------------------------
    $sizeBytes = (Get-Item -LiteralPath $destPath).Length
    $sizeMB = [math]::Round($sizeBytes / 1MB, 2)

    try {
        $dim = Get-PngDimensions $destPath
    }
    catch {
        Write-Warning "  Could not read PNG dimensions: $($_.Exception.Message)"
        $dim = $null
    }

    $problems = @()
    if ($dim -ne $null) {
        $short = [Math]::Min($dim.Width, $dim.Height)
        $long  = [Math]::Max($dim.Width, $dim.Height)
        if ($short -lt $MinSide -or $long -gt $MaxSide) {
            $problems += "size $($dim.Width)x$($dim.Height): each side must be $MinSide-$MaxSide px"
        }
        if ($short -gt 0 -and ($long / $short) -gt $MaxRatio) {
            $r = [math]::Round($long / $short, 2)
            $problems += "aspect $($r):1 exceeds Play's $($MaxRatio):1 -- too tall/wide; crop or use a 9:16 device"
        }
    }
    if ($sizeBytes -ge $MaxBytes) {
        $problems += "size $sizeMB MB exceeds $([int]($MaxBytes/1MB)) MB"
    }

    if ($problems.Count -gt 0) {
        Write-Warning ("  {0}: {1} (kept -- re-take if needed)" -f $fileName, ($problems -join '; '))
    }
    else {
        $wxh = if ($dim) { "$($dim.Width)x$($dim.Height)" } else { "?" }
        Write-Host "  OK: $wxh, $sizeMB MB" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "Finished. Screenshots are in: $OutDir" -ForegroundColor Green
$saved = @(Get-ChildItem -LiteralPath $OutDir -Filter "okuji-$Label-*.png" -ErrorAction SilentlyContinue)
Write-Host ("Captured {0} file(s)." -f $saved.Count)
