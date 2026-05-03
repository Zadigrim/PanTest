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
        'panoply-navy':    '#0D1B2A',
        'panoply-teal':    '#1D9E75',
        'panoply-teal-dk': '#0F6E56',
        'panoply-teal-lt': '#E1F5EE',
        'panoply-amber':   '#EF9F27',
        'panoply-coral':   '#D85A30',
        'panoply-purple':  '#7F77DD',
        'panoply-gray-1':  '#F7F9F8',
        'panoply-gray-2':  '#E8EEF0',
        'panoply-gray-3':  '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      spacing: {
        '4.5': '18px',
      },
      borderRadius: {
        card: '6px',
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
