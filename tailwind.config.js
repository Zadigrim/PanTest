/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
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
        // Legacy Panoply scale — retained during migration to canonical tokens.
        passport: {
          navy: '#0D1B2A',
          cream: '#F5F0E8',
          gold: '#C9A84C',
          green: '#1D9E75',
          blue: '#2D5A8E',
          red: '#9B2335',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
