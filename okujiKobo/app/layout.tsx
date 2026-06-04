import type { Metadata } from 'next'
import {
  Inter,
  Playfair_Display,
  Lora,
  Bebas_Neue,
  Abril_Fatface,
} from 'next/font/google'
import { AdminOverlay } from '@/components/admin/AdminOverlay'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700'],
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  weight: ['400', '700'],
  display: 'swap',
})

const bebas = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-bebas',
  weight: '400',
  display: 'swap',
})

const abril = Abril_Fatface({
  subsets: ['latin'],
  variable: '--font-abril',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'okujiKobo',
  description: 'Discover and collect passport experiences',
  icons: {
    icon: [
      { url: '/appicon/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/appicon/png/okuji-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/appicon/png/okuji-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/appicon/png/okuji-icon-180.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} ${lora.variable} ${bebas.variable} ${abril.variable}`}
      >
        <AdminOverlay>
          {children}
        </AdminOverlay>
        <Analytics />
      </body>
    </html>
  )
}
