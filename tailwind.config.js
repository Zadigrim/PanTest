/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
