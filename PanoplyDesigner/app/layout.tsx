import type { Metadata } from 'next'
import './globals.css'
import { MobileGuard } from '@/components/ui/MobileGuard'

export const metadata: Metadata = {
  title: 'PanoplyDesigner',
  description: 'Create and publish travel passports',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MobileGuard />
        {children}
      </body>
    </html>
  )
}
