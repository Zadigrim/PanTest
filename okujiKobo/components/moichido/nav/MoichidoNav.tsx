import Link from 'next/link'
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
 */
const LINKS = [
  { href: '/moichido', label: 'Home' },
  { href: '/moichido/cards', label: 'Cards' },
  { href: '/moichido/terminal', label: 'Terminal' },
]

export function MoichidoNav() {
  return (
    <header className="border-b border-moichido-hairline bg-moichido-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/moichido" className="flex items-center gap-2 text-moichido-teal">
          <RingMark size={26} strokeWidth={2.4} />
          <Wordmark className="text-xl text-moichido-teal" />
        </Link>
        <nav className="flex items-center gap-4">
          {LINKS.map((l) => (
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
