/**
 * okujiKōbō first-login welcome modal — copy module.
 *
 * Every user-facing string + every audience variant lives here so a
 * non-engineer can edit prose without touching layout. The modal,
 * loop steps, audience band, and CTA labels all draw from this one
 * exported object. Adding a new audience variant means adding a key
 * to `audience.*` and a branch in the variant selector in
 * `components/welcome/WelcomeModal.tsx`.
 *
 * Interpolation: `{institutionName}` is the only placeholder. The
 * selector replaces it before render.
 *
 * Voice notes (do not lose on edit):
 *   - The Print step is creator-voiced. Public Explore downloads are
 *     free-passports-only, so "your passport folds…" is honest;
 *     a generic "passports fold" implies anyone can print anyone's,
 *     which is not the product.
 *   - The institutional-without-can_design band frames absence-of-
 *     can_design as a status, not a denial. The shape is roughly
 *     "your role grows" rather than "you are blocked".
 *   - The individual variant is neutral, no Studio upsell.
 *   - Templates are deliberately NOT mentioned anywhere — the feature
 *     is disabled / "coming soon" — so the institutional-with-design
 *     band says "from a blank booklet".
 *   - "okujiKōbō" is the product name in prose. The wordmark lockup
 *     in the modal header (`okuji` + `kōbō`) is a one-off display
 *     treatment that does NOT generalize.
 */

export interface AudienceCopy {
  title: string
  sub: string
}

export interface CtaCopy {
  primaryLabel: string
  primaryHref: string
  secondaryLabel?: string
  secondaryHref?: string
}

export const WELCOME_COPY = {
  // ── Header ────────────────────────────────────────────
  kicker: '— WELCOME —',
  wordmarkLeading: 'okuji',
  wordmarkTrailing: 'kōbō',
  identityLine:
    'okujiKōbō is where passports are made — design a booklet of real-world stops, ' +
    'publish it, and collectors earn a stamp at each one.',

  // ── The Loop — four steps ─────────────────────────────
  loop: {
    sectionLabel: 'The Loop',
    steps: [
      {
        key: 'design',
        word: 'Design',
        line: 'Lay out pages and stops in the designer.',
        iconPath: '/stamp-icons/loop-design.svg',
      },
      {
        key: 'publish',
        word: 'Publish',
        line: 'Share it free, or set a price.',
        iconPath: '/stamp-icons/loop-publish.svg',
      },
      {
        key: 'collect',
        word: 'Collect',
        line: 'People stamp each stop in the real world.',
        iconPath: '/stamp-icons/loop-collect.svg',
      },
      {
        key: 'print',
        word: 'Print',
        // Creator-voiced — public Explore downloads are free-only,
        // so this line is honest for the modal's audience.
        line: 'Your passport folds into a paper booklet.',
        iconPath: '/stamp-icons/loop-print.svg',
      },
    ] as const,
  },

  // ── Audience variants ─────────────────────────────────
  // {institutionName} is replaced at render time.
  audience: {
    institutional_designer: {
      title: "You're part of {institutionName}.",
      sub:
        'You can design and publish passports for {institutionName}. ' +
        'Start from a blank booklet.',
    } as AudienceCopy,

    institutional_member: {
      title: "You're part of {institutionName}.",
      sub:
        'Your access is managed by {institutionName} — explore passports ' +
        'and the stop library while your role grows.',
    } as AudienceCopy,

    individual: {
      title: 'Designing on your own',
      sub:
        'Design and print passports freely. Publishing to the public ' +
        'marketplace uses Studio.',
    } as AudienceCopy,

    // Admin band is intentionally omitted from render — kept here
    // empty for documentation only.
    admin: null,
  },

  // ── CTA labels ────────────────────────────────────────
  cta: {
    institutional_designer: {
      primaryLabel: 'Open the designer',
      primaryHref:  '/design',
      secondaryLabel: 'Explore passports',
      secondaryHref:  '/explore',
    } as CtaCopy,

    institutional_member: {
      // Their actionable surface is Explore — the brief drops the
      // secondary slot here on purpose.
      primaryLabel: 'Explore passports',
      primaryHref:  '/explore',
    } as CtaCopy,

    individual: {
      primaryLabel: 'Create your first passport',
      primaryHref:  '/design',
      secondaryLabel: 'Explore passports',
      secondaryHref:  '/explore',
    } as CtaCopy,

    admin: {
      primaryLabel: 'Open the designer',
      primaryHref:  '/design',
      secondaryLabel: 'Explore passports',
      secondaryHref:  '/explore',
    } as CtaCopy,
  },

  skipLink:    'Skip for now',
  closeLabel:  'Close',
  reopenLabel: 'About okujiKōbō',
} as const

export type AudienceKey = keyof typeof WELCOME_COPY.cta

/** Replace `{institutionName}` in a string with the actual name. */
export function interpolate(s: string, institutionName: string | null): string {
  if (!institutionName) return s
  return s.replaceAll('{institutionName}', institutionName)
}
