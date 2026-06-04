import type { ReactNode } from 'react'
import { DesktopGate } from '@/components/design/DesktopGate'

export const metadata = {
  title: 'okuji Designer',
}

/**
 * Layout for the (design) route group.
 *
 * - No shared chrome (no marketplace nav, no footer) — the designer has its own topbar.
 * - Wraps everything in <DesktopGate> which blocks viewports narrower than 1024 px
 *   with a full-screen overlay.
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  return <DesktopGate>{children}</DesktopGate>
}
