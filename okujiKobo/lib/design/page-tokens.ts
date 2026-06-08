/**
 * Page-element token substitution.
 *
 * Parallel to lib/design/stamp-composer/date-token.ts but scoped
 * to page text elements (the designer's on-artwork text) rather
 * than stamp composer text. Today's only token is {{copy_number}};
 * shape designed to grow.
 *
 * The {{copy_number}} token resolves to the holder's per-copy
 * serial at render time. Persisted verbatim in the text element's
 * `content` (or per-run `text` for RichTextPageElement) so the
 * designer just types/inserts the literal and never thinks about
 * substitution.
 *
 * Render-time substitution shape:
 *   - Holder view (web read-only): substitute with the actual
 *     collector_passports.copy_number value.
 *   - Designer canvas (sample): substitute with the
 *     PLACEHOLDER_COPY_NUMBER below so the designer sees a
 *     realistic preview (e.g. "001 of 250" reads correctly at
 *     design time even though no holder exists yet).
 *
 * Per CLAUDE.md governing invariant #6 (honest data only): a
 * NULL holder context (e.g. preview without a real copy) renders
 * the placeholder, NEVER a fabricated real-looking value. The
 * placeholder ("#") is visibly a sample, not a number.
 */

export const COPY_NUMBER_TOKEN_LITERAL = '{{copy_number}}'
export const COPY_NUMBER_TOKEN_RE = /\{\{copy_number\}\}/g

/** Designer-preview placeholder for {{copy_number}}. Renders
 *  visibly as a sample, not a number, so the designer
 *  doesn't confuse the placeholder with a real assignment. */
export const COPY_NUMBER_PLACEHOLDER = '#'

export function hasCopyNumberToken(s: string | null | undefined): boolean {
  if (!s) return false
  return s.includes(COPY_NUMBER_TOKEN_LITERAL)
}

export interface CopyNumberContext {
  /** When set, substitute with this number (rendered as-is, no
   *  zero-padding by default per Nathan's M2 follow-up ruling).
   *  null/undefined renders the placeholder. */
  copyNumber?: number | null
}

function resolveCopyNumber(ctx: CopyNumberContext): string {
  if (ctx.copyNumber == null) return COPY_NUMBER_PLACEHOLDER
  return String(ctx.copyNumber)
}

/** Substitute {{copy_number}} in a text string. Used by every
 *  page-text render path (designer canvas in sample mode,
 *  holder view with the real number). */
export function applyCopyNumberToken(text: string, ctx: CopyNumberContext): string {
  if (!text || !hasCopyNumberToken(text)) return text
  return text.replace(COPY_NUMBER_TOKEN_RE, resolveCopyNumber(ctx))
}

// ── Expiry display ─────────────────────────────────────────────
// Lives here rather than in a separate module because every
// per-copy display surface (token render layer) needs both.

/** Format a stored expires_at (timestamptz from
 *  collector_passports.expires_at) as MM/DD/YYYY. Mirrors the
 *  stamp date-token formatter for consistency. NULL renders
 *  as "No expiry" — honest, not a fabricated date. */
export function formatExpiryDate(input: string | Date | null | undefined): string {
  if (input == null) return 'No expiry'
  const d = typeof input === 'string' ? new Date(input) : input
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'No expiry'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}
