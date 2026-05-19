import type { ReactNode } from 'react'
import AppNav from '@/components/layout/AppNav'

export const metadata = {
  title: 'Explore · OkujiConnect',
  description: 'Browse published passports from creators — discover and find inspiration.',
}

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <AppNav />
      <main>{children}</main>
    </div>
  )
}
