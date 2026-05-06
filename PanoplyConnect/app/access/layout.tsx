import type { ReactNode } from 'react'
import AppNav from '@/components/layout/AppNav'

export default function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <AppNav />
      {children}
    </div>
  )
}
