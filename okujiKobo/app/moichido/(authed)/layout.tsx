import type { ReactNode } from 'react'
import { MoichidoNav } from '@/components/moichido/nav/MoichidoNav'

export const metadata = {
  title: 'moichido',
  description: 'Merchant management — moichido punch cards',
}

/**
 * moichido shell layout. Used for every page under app/moichido/*.
 * Reachable in production only via the moichido.app host (the
 * middleware rewrites moichido.app requests into /moichido/*; a
 * direct /moichido URL on the okuji host is 404'd).
 *
 * Surface isolation: composes brand chrome from
 * components/moichido/* only. Does not import AppNav, RoleSwitcher,
 * or any okuji-themed component. The okuji color palette (ink,
 * paper, accent, etc.) is never referenced here.
 *
 * No SidebarProvider or AdminOverlay equivalents in M4.1 — the
 * merchant surface gets its own affordances when M4.x features
 * land. For now the layout exists to enforce isolation and
 * establish the visual language.
 */
export default function MoichidoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-moichido-paper font-moichido text-moichido-ink">
      <MoichidoNav />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
