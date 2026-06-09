import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Okuji palette — canonical tokens
        // Do not add tint scales. Softer tones come from opacity over ink or paper.
        // Any color outside this set must be either a functional exception or a bug.
        ink: '#1f1d1a',
        paper: '#f6f1e6',
        cream: '#f5f0e8',
        muted: '#6b6356',
        hairline: '#c8bfa9',
        accent: '#c9a84c',
        green: '#1d9e75',
        red: '#9b2335',
        blue: '#2d5a8e',
        navy: '#0d1b2a',

        // Program-hub additions (unified Program design system).
        // - clay: the single Note / announcement accent — warm terracotta,
        //   distinct from accent (gold) and red (error). Replaces the
        //   ad-hoc gold/red borders on info banners with one voice.
        // - field: form input + segmented-track surface — a warm tint
        //   between paper (page bg) and white (card bg) so inputs read
        //   as recessed without a heavy fill.
        // Both used by the Program tab kit at components/program/ui/*.
        clay:  '#b07a4f',
        field: '#f0e9d8',

        // Kōbō (Designer-only) editor surface tones. These render the
        // workshop chrome around the passport spread — they are NOT
        // brand colors, never appear on the collector app, and should
        // be used via the `bg-surface-*` utilities only on designer
        // screens. Hue ladder runs warm-light → warm-deeper → espresso.
        surface: {
          workspace: '#fbfaf3',  // inspector panels + body of form-style designer screens
          rail:      '#efe7d2',  // left rail / sidebar (one step deeper)
          chrome:    '#e9e1c9',  // app top bar / window chrome strip
          canvas:    '#2a1f12',  // dark editor mat behind the passport spread
          page:      '#f5ecd0',  // the passport-page paper default sitting on the canvas
          faintdiv:  '#e4dcc8',  // table row borders / faint section dividers on workspace bg
        },

        // Cover paper-stock swatches (the cover editor's paper-color
        // picker). Named-not-hex so future tweaks happen in one place.
        stock: {
          forest:  '#1d4d2e',
          oxblood: '#5a1a1f',
          navy:    '#0d1b2a',
          walnut:  '#5a3a1a',
          jet:     '#2a1f12',
        },

        // moichido tokens — totally isolated palette for the
        // moichido merchant surface (app/moichido/*). The okuji
        // tree never references bg-moichido-* / text-moichido-*;
        // the moichido tree never references bg-paper / text-ink /
        // etc. Surface isolation per CLAUDE.md.
        //
        // Source of truth: okujiKobo/lib/moichido/tokens.ts. When
        // refining brand hexes, update both files — they read as
        // independent because Tailwind doesn't import TS objects
        // into its config without a build step we'd rather avoid.
        moichido: {
          teal:     '#0F4C5C',
          apricot:  '#E8915D',
          ink:      '#1A1410',
          paper:    '#FBF7F2',
          hairline: '#E2D7C6',
          muted:    '#7A6F62',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        // moichido wordmark + chrome font. Registered via
        // next/font in app/layout.tsx; the variable is set on
        // body and inherited inside the moichido layout via the
        // `font-moichido` utility (used on the body wrapper there).
        // okuji surfaces never set this utility.
        moichido: ['var(--font-space-grotesk)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:  '6px',
        panel: '8px',
        modal: '12px',
        // Program kit radii (per mock).
        'program-card':    '14px',
        'program-control': '9px',
        'program-pill':    '20px',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
