import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PanoplyConnect',
  description: 'Discover and collect passport experiences',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
