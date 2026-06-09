/**
 * moichido brand tokens.
 *
 * Source of truth for the moichido surface. Pair with the
 * `moichido.*` color group in tailwind.config.ts. The okuji surface
 * never imports from this file; the moichido surface never imports
 * from the okuji `ink`/`paper`/`accent` palette.
 *
 * Palette is the M4.1 starting point — Deep Teal + Apricot per the
 * brand spec. Specific hexes are placeholders to refine once the
 * brand pass lands; the structure (semantic names: teal/apricot/
 * ink/paper) is what code depends on.
 */

export const MOICHIDO_TOKENS = {
  // Primary brand color — Deep Teal. Deep enough to be readable
  // as chrome surface, saturated enough to feel branded.
  teal: '#0F4C5C',
  // Accent — Apricot. Used for the ichi-highlight in the wordmark,
  // primary actions, and the "currently filling" ring on the mark.
  apricot: '#E8915D',
  // Neutrals — separate from okuji's ink/paper. Slightly warmer
  // than okuji's neutrals to pair with the apricot accent.
  ink:    '#1A1410',
  paper:  '#FBF7F2',
  // Subtle tone for separators / hairline rules on a paper bg.
  hairline: '#E2D7C6',
  // Muted text on paper.
  muted:  '#7A6F62',
} as const

export type MoichidoToken = keyof typeof MOICHIDO_TOKENS
