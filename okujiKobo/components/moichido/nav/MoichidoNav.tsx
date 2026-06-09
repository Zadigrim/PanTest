import { Wordmark } from '../Wordmark'
import { RingMark } from '../marks/RingMark'

/**
 * moichido top nav — minimal frame for M4.1. No links yet because
 * there are no merchant features to link to; the future M4.x
 * additions will populate this with merchant routes (card designer,
 * punch designer, terminal, etc.).
 *
 * Deliberately does NOT import any okuji nav component. Even though
 * AppNav exists in the same repo, isolation means the moichido
 * surface composes its own chrome from moichido pieces only.
 */
export function MoichidoNav() {
  return (
    <header className="border-b border-moichido-hairline bg-moichido-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
        <span className="flex items-center gap-2 text-moichido-teal">
          <RingMark size={26} strokeWidth={2.4} />
          <Wordmark className="text-xl text-moichido-teal" />
        </span>
      </div>
    </header>
  )
}
