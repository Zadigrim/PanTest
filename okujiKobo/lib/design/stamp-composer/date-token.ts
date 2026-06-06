/**
 * Stamp-composer date-token substitution.
 *
 * The composer lets designers insert `{{date}}` inside a text /
 * curvedText element. The token is preserved verbatim through both
 * persistence surfaces:
 *
 *   1. design_assets.metadata (the live ComposerMetadata JSON — what
 *      "Edit in composer" reloads from). el.text stores the literal
 *      `{{date}}` string.
 *   2. The static SVG file at design-assets/{owner}/stamp-{ts}.svg.
 *      The serializer's escapeText only escapes <, >, & — curly
 *      braces pass through, so the SVG body carries `{{date}}`
 *      verbatim too.
 *
 * Substitution is PER-CONSUMER AT RENDER TIME:
 *
 *   - Mobile (RN StampArtwork) substitutes after recolorSvg so the
 *     SvgXml input has both currentColor → hex AND the date filled
 *     in. The earned date for the instance is stamp.verified_at
 *     (timestamptz from the DB; interpreted in the viewer's local
 *     tz here, since only the date matters and the viewer's tz is
 *     the right one for displaying "their" date).
 *
 *   - Web kobo (StampPreview) substitutes svgText before
 *     dangerouslySetInnerHTML. The kobo always renders sample mode
 *     (today's date) because it's a designer preview, not a
 *     per-instance render.
 *
 *   - Print PDF (renderStampForPdf) substitutes the svg string
 *     before parseSvg. Today the PDF route renders blank passports
 *     only (no earned-instance iteration), so it always falls
 *     through to sample mode. If/when an earned-print mode lands,
 *     it passes a real date in.
 *
 *   - Composer canvas (ComposerCanvas) renders elements DIRECTLY
 *     from el.text without going through the SVG file — so it calls
 *     applyDateTokenToText() on el.text before rendering.
 *
 * Ghost / unearned stamps render the token as 3 em-dashes (———)
 * instead of either a literal `{{date}}` (visual noise) or today's
 * date (would mislead the holder into thinking they earned it
 * today). Three-character width also keeps the stamp composition
 * from collapsing if the date is part of a longer phrase.
 *
 * Scope guards honored:
 *   - Date token ONLY. No location-name / collector-name tokens.
 *   - No date-format options, no tz settings UI. MM/DD/YYYY fixed.
 *   - Stamp storage model untouched — token preserved in existing
 *     fields (metadata.elements[].text + the SVG body), no
 *     migration, no asset regeneration.
 */

/** The literal token designers type / the Date chip inserts. */
export const DATE_TOKEN_LITERAL = '{{date}}'

/** Global regex for substitution. Always global — multiple
 *  occurrences in one element get all replaced. */
export const DATE_TOKEN_RE = /\{\{date\}\}/g

/** What ghost / unearned stamps render in place of the token.
 *  Three em-dashes — same approximate width as MM/DD/YYYY so the
 *  surrounding text composition doesn't shift between ghost and
 *  earned states. */
export const GHOST_DATE_PLACEHOLDER = '———'

/** True if the string contains the date token. Cheap pre-check so
 *  consumers can skip the replace on the common no-token path. */
export function hasDateToken(s: string | null | undefined): boolean {
  if (!s) return false
  return s.includes(DATE_TOKEN_LITERAL)
}

/**
 * Format a Date (or ISO/timestamptz string) as `MM/DD/YYYY` in the
 * viewer's local timezone.
 *
 * Why local? The instance date is `stamps.verified_at` — a UTC
 * timestamptz captured when the stamp was placed. We display it in
 * the VIEWER's tz, which is the right "their date" surface in the
 * overwhelming common case (collector earns + views in their home
 * tz). A nomadic collector who earns abroad and views the same day
 * from a different tz could see a one-day boundary effect; that's
 * acceptable per the spec ("the time is less relevant than the
 * date") and not worth a tz-lookup library.
 *
 * Returns null when the input is null/undefined/unparseable — the
 * caller decides whether to substitute a ghost placeholder or
 * leave the token unresolved.
 */
export function formatStampDate(input: Date | string | null | undefined): string | null {
  if (input == null) return null
  const d = typeof input === 'string' ? new Date(input) : input
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

/** Today's date in the viewer's tz, MM/DD/YYYY. Used by the
 *  composer canvas + every "sample mode" surface (kobo preview,
 *  blank-passport PDF). */
export function todaysStampDate(): string {
  // Non-null by construction — new Date() is always valid.
  return formatStampDate(new Date())!
}

// ── Substitution helpers ────────────────────────────────────────────────────

export interface DateTokenContext {
  /** When set, substitute with this date (already formatted MM/DD/YYYY).
   *  Pass null to either use the ghost placeholder (when ghost=true)
   *  or fall back to today's date (when ghost=false). */
  date?: string | null
  /** Ghost / unearned state. With date=null this emits em-dashes. */
  ghost?: boolean
}

/** Resolve the string to substitute the token with, given the context.
 *  Sample mode (no date, not ghost) defaults to today. */
export function resolveDateSubstitution(ctx: DateTokenContext): string {
  if (ctx.ghost && !ctx.date) return GHOST_DATE_PLACEHOLDER
  return ctx.date ?? todaysStampDate()
}

/**
 * Substitute the date token in a SVG string. Used by every consumer
 * that renders FROM the stored SVG file (kobo StampPreview, mobile
 * StampArtwork, PDF renderStampForPdf).
 *
 * Token is escape-safe (no <, >, &) so straight string replace on
 * the SVG body is correct.
 */
export function substituteDateInSvg(svg: string, ctx: DateTokenContext): string {
  if (!svg || !hasDateToken(svg)) return svg
  return svg.replace(DATE_TOKEN_RE, resolveDateSubstitution(ctx))
}

/**
 * Substitute the date token in a single text element's text field.
 * Used by the composer's LIVE canvas (ComposerCanvas) which renders
 * elements directly from ComposerMetadata without going through the
 * SVG serializer.
 */
export function applyDateTokenToText(text: string, ctx: DateTokenContext): string {
  if (!text || !hasDateToken(text)) return text
  return text.replace(DATE_TOKEN_RE, resolveDateSubstitution(ctx))
}
