import { RingMark } from '@/components/moichido/marks/RingMark'

/**
 * moichido merchant landing — M4.1 placeholder only.
 *
 * Per the M4.1 scope guards: NO merchant features in this prompt.
 * The honest placeholder makes the surface real (you can visit it,
 * confirm isolation works, see the brand chrome) without faking
 * any data or hinting at features that don't exist yet.
 */
export default function MoichidoLanding() {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-moichido-teal">
        <RingMark size={72} strokeWidth={2} />
      </span>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-moichido-ink">
        Merchant management — coming
      </h1>
      <p className="mt-3 max-w-md text-sm text-moichido-muted">
        The moichido merchant surface is being built. Card design,
        punch design, terminal, and onboarding land in future
        releases.
      </p>
    </section>
  )
}
