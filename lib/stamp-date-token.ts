/**
 * Stamp date-token substitution — mobile mirror.
 *
 * CANONICAL: okujiKobo/lib/design/stamp-composer/date-token.ts.
 * That file is the source of truth for the token contract; this
 * mirror exists ONLY because the mobile tsconfig excludes
 * okujiKobo/ (see tsconfig.json#exclude). Keep these two in sync.
 *
 * Substitutes `{{date}}` inside a composed-stamp SVG with either:
 *   - the stamp instance's earned date (formatted MM/DD/YYYY in
 *     the viewer's local timezone — interpreted from
 *     stamps.verified_at)
 *   - em-dashes for ghost / unearned stamps (so the surrounding
 *     composition doesn't visually collapse)
 *   - today's date for sample-mode previews (placement screen
 *     before the stamp actually gets recorded)
 */

export const DATE_TOKEN_LITERAL = '{{date}}'
export const DATE_TOKEN_RE = /\{\{date\}\}/g
export const GHOST_DATE_PLACEHOLDER = '———'

export function hasDateToken(s: string | null | undefined): boolean {
  if (!s) return false
  return s.includes(DATE_TOKEN_LITERAL)
}

export function formatStampDate(input: Date | string | null | undefined): string | null {
  if (input == null) return null
  const d = typeof input === 'string' ? new Date(input) : input
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

export function todaysStampDate(): string {
  return formatStampDate(new Date())!
}

export interface DateTokenContext {
  /** Already-formatted MM/DD/YYYY. null falls back to either ghost
   *  placeholder or today's date depending on `ghost`. */
  date?: string | null
  ghost?: boolean
}

function resolveDateSubstitution(ctx: DateTokenContext): string {
  if (ctx.ghost && !ctx.date) return GHOST_DATE_PLACEHOLDER
  return ctx.date ?? todaysStampDate()
}

export function substituteDateInSvg(svg: string, ctx: DateTokenContext): string {
  if (!svg || !hasDateToken(svg)) return svg
  return svg.replace(DATE_TOKEN_RE, resolveDateSubstitution(ctx))
}
