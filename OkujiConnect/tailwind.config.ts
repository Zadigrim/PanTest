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
        // Legacy okuji-* palette — retained during migration to canonical tokens.
        'okuji-navy':    '#0D1B2A',
        'okuji-teal':    '#1D9E75',
        'okuji-teal-dk': '#0F6E56',
        'okuji-teal-lt': '#E1F5EE',
        'okuji-amber':   '#EF9F27',
        'okuji-coral':   '#D85A30',
        'okuji-purple':  '#7F77DD',
        'okuji-gray-1':  '#F7F9F8',
        'okuji-gray-2':  '#E8EEF0',
        'okuji-gray-3':  '#64748B',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      borderRadius: {
        card:  '6px',
        panel: '8px',
        modal: '12px',
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
