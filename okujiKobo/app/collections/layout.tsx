import type { ReactNode } from 'react'
import { DesktopGate } from '@/components/design/DesktopGate'

export const metadata = { title: 'Collections — okuji Designer' }

// Mirrors the /design layout: desktop-gated, no marketplace chrome (the
// designer surfaces carry their own topbar).
export default function CollectionsLayout({ children }: { children: ReactNode }) {
  return <DesktopGate>{children}</DesktopGate>
}
