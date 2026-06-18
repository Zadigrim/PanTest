import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Wordmark } from '../Wordmark'
import { RingMark } from '../marks/RingMark'

/**
 * moichido top nav. Links to the merchant surfaces that exist today
 * (home, cards, terminal). Future M4.x additions populate this with
 * more merchant routes.
 *
 * Deliberately does NOT import any okuji nav component. Even though
 * AppNav exists in the same repo, isolation means the moichido
 * surface composes its own chrome from moichido pieces only.
 *
 * The platform-admin "Merchants" console link appears only for admins
 * (is_platform_admin) — the console route is also gated server-side.
 */
const LINKS = [
  { href: '/moichido', label: 'Home' },
  { href: '/moichido/cards', label: 'Cards' },
  { href: '/moichido/terminal', label: 'Terminal' },
]

export async function MoichidoNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc('is_platform_admin')
    isAdmin = data === true
  }
  const links = isAdmin
    ? [...LINKS, { href: '/moichido/merchants', label: 'Merchants' }]
    : LINKS

  return (
    <header className="border-b border-moichido-hairline bg-moichido-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/moichido" className="flex items-center gap-2 text-moichido-teal">
          <RingMark size={26} strokeWidth={2.4} />
          <Wordmark className="text-xl text-moichido-teal" />
        </Link>
        <nav className="flex items-center gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-moichido-muted hover:text-moichido-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
