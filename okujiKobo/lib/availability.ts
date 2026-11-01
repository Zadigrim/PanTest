// Availability-window helpers (passport effective/expire dates).
//
// No timezone/date library exists in the repo by deliberate choice, so these
// implement the two things the designer needs with `Intl` only:
//   - wallTimeToUtc: turn a creator-entered local calendar date ("2027-01-01"
//     at 00:00 in America/Los_Angeles) into the stored UTC instant
//     (2027-01-01T08:00:00.000Z). Instants are always stored in UTC; the IANA
//     zone is kept only for display + this conversion.
//   - formatWindowRange / formatUtc: human-readable display.
//
// DST edge note: the wall->UTC conversion uses a single offset sample at the
// guessed instant. Midnight / 23:59:59.999 virtually never coincide with a DST
// transition, so day boundaries are exact; a one-hour error could only occur if
// a window edge landed inside the ~1h spring-forward gap, which the date-only
// UI cannot express.

/** Milliseconds the IANA zone is ahead of UTC at the given instant. */
export function tzOffsetMs(tz: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const p: Record<string, string> = {}
    for (const part of dtf.formatToParts(at)) p[part.type] = part.value
    // Intl may render hour '24' at midnight; normalize to 0.
    const hour = p.hour === '24' ? 0 : Number(p.hour)
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second))
    return asUtc - at.getTime()
  } catch {
    return 0 // unknown zone → treat as UTC
  }
}

/**
 * Convert a local wall-clock date+time in `tz` to the UTC instant (ISO string).
 * @param dateStr 'YYYY-MM-DD'
 * @param timeStr 'HH:mm:ss.SSS'
 */
export function wallTimeToUtc(dateStr: string, timeStr: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const [, y, mo, d] = m
  const tm = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(timeStr)
  if (!tm) return null
  const [, hh, mi, ss, ms] = tm
  // Treat the wall components as if they were UTC, then subtract the zone's
  // offset at that guessed instant to land on the true UTC instant.
  const guess = Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss, ms ? +ms.padEnd(3, '0') : 0)
  const off = tzOffsetMs(tz, new Date(guess))
  return new Date(guess - off).toISOString()
}

/** Start of the given local date (00:00:00.000) as a UTC ISO instant. */
export function startOfLocalDayUtc(dateStr: string, tz: string): string | null {
  return wallTimeToUtc(dateStr, '00:00:00.000', tz)
}

/** End of the given local date (23:59:59.999) as a UTC ISO instant. */
export function endOfLocalDayUtc(dateStr: string, tz: string): string | null {
  return wallTimeToUtc(dateStr, '23:59:59.999', tz)
}

/** The local calendar date ('YYYY-MM-DD') an instant falls on, in `tz`. */
export function utcToLocalDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return ''
  try {
    const p: Record<string, string> = {}
    for (const part of new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(iso))) p[part.type] = part.value
    return `${p.year}-${p.month}-${p.day}`
  } catch { return '' }
}

/** "Jan 1, 2027" in the given zone. Pass `endExclusive` for a window end to
 *  show the last valid day (end is stored exclusive). */
export function formatDay(iso: string | null | undefined, tz: string, endExclusive = false): string {
  if (!iso) return ''
  const d = new Date(endExclusive ? new Date(iso).getTime() - 1000 : iso)
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  }
}

/** Compact badge text: "Jan 1 to Dec 31, 2027" / "Opens Jan 1, 2027" /
 *  "Through Dec 31, 2027". Empty string when no window is set. */
export function formatWindowRange(
  effectiveAt: string | null | undefined,
  expiresAt: string | null | undefined,
  tz: string | null | undefined,
): string {
  const zone = tz || 'UTC'
  if (!effectiveAt && !expiresAt) return ''
  if (effectiveAt && expiresAt) return `${formatDay(effectiveAt, zone)} to ${formatDay(expiresAt, zone, true)}`
  if (effectiveAt) return `Opens ${formatDay(effectiveAt, zone)}`
  return `Through ${formatDay(expiresAt, zone, true)}`
}

/** IANA zones for the dropdown, with a safe fallback for older runtimes. */
export function supportedTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (fn) return fn('timeZone')
  } catch { /* fall through */ }
  return [
    'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Anchorage', 'Pacific/Honolulu', 'UTC', 'Europe/London', 'Europe/Paris',
    'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
  ]
}

/** The designer's current browser zone, as the default for new windows. */
export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}
