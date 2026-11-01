// Passport availability-window state for the collector app (migration 110).
//
// Pure display/derivation — the hard enforcement is server-side (the
// passport_is_stampable helper + BEFORE INSERT triggers + the verify-stamp
// pre-check). This mirrors that rule so the UI can show "Opens …"/"Ended …"
// and disable the stamp action BEFORE a doomed round-trip. Server time is
// authoritative; this uses the device clock only for proactive UI and never
// to permit a stamp (the server re-checks).
//
// Start is inclusive (now >= effective_at), end is exclusive (now < expires_at).

export type WindowState = 'open' | 'upcoming' | 'ended'

interface WindowFields {
  effective_at?: string | null
  expires_at?: string | null
  availability_timezone?: string | null
}

function fmtDay(iso: string, tz: string, endExclusive = false): string {
  // End is stored exclusive — show the last valid day ("Ended Dec 31", not Jan 1).
  const d = new Date(endExclusive ? new Date(iso).getTime() - 1000 : iso)
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  }
}

export function passportWindowState(p: WindowFields, nowMs: number = Date.now()): {
  state: WindowState
  /** Collector-facing one-liner for upcoming/ended; null when open. */
  message: string | null
} {
  const tz = p.availability_timezone || 'UTC'
  if (p.effective_at && nowMs < new Date(p.effective_at).getTime()) {
    return { state: 'upcoming', message: `Opens ${fmtDay(p.effective_at, tz)}` }
  }
  if (p.expires_at && nowMs >= new Date(p.expires_at).getTime()) {
    return { state: 'ended', message: `Ended ${fmtDay(p.expires_at, tz, true)}` }
  }
  return { state: 'open', message: null }
}

/** Convenience: can a collector stamp right now (mirrors passport_is_stampable). */
export function isStampableNow(p: WindowFields, nowMs: number = Date.now()): boolean {
  return passportWindowState(p, nowMs).state === 'open'
}
