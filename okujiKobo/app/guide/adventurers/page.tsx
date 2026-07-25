import type { Metadata } from 'next'
import { Section, Note, FigureSlot } from '../guide-ui'

// Collector-facing guide. Every capability described is live today:
// browse/acquire free passports, the three real stamp-verification methods
// (honor / GPS / QR+GPS), journaling (text+mood, photos, on-device voice),
// the private back-journal pages, and being shown a completion code to redeem
// in person. Intentionally omitted because dormant/not-built: paid purchase,
// witnessed/employee stamping, and print (no collector print exists).
export const metadata: Metadata = {
  title: 'For adventurers — okuji',
  robots: { index: false, follow: false },
}

export default function AdventurersGuidePage() {
  return (
    <article>
      <h1 className="text-[30px] font-bold text-ink" style={{ letterSpacing: '-0.015em' }}>
        Your passport, and how to fill it
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-muted">
        okuji is a stamp collection you carry with you. You pick up a passport,
        travel to the places inside it, and earn a stamp at each one — then make
        the page yours with a few words, a photo, or a spoken memory. Here&rsquo;s
        the whole of it.
      </p>

      <Section title="Start your collection">
        <p>
          Open the app and browse. In <strong>Catalogue</strong> you&rsquo;ll
          see the passports on the shelf; in <strong>Nearby</strong> you&rsquo;ll
          see what&rsquo;s waiting around you geographically. When one calls to
          you, tap <strong>Get</strong> and it drops into your collection — free
          passports are yours to keep right away, no account juggling.
        </p>
        <FigureSlot label="browsing the catalogue shelf" />
      </Section>

      <Section title="Collect a stamp">
        <p>
          Every stop confirms you were really there — but the way it checks
          depends on the place. There are three:
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-hairline">
          <li>
            <strong>Just tap.</strong> Some stops — events, experiences — run on
            the honor system. You say you were there, and the stamp is yours.
          </li>
          <li>
            <strong>Be there.</strong> Many stops check your location. Stand
            within reach of the spot (about 150&nbsp;metres) and the stamp
            unlocks.
          </li>
          <li>
            <strong>Scan the code.</strong> Some stops have a code on-site. Point
            your camera at it while you&rsquo;re there — it has to match, and you
            have to be in range, so the code alone won&rsquo;t work from home.
          </li>
        </ul>
        <p>
          You&rsquo;ll always know which kind a stop is when you open it; there&rsquo;s
          nothing to set up.
        </p>
      </Section>

      <Section title="Make it yours">
        <p>
          Earning the stamp is only half of it. Press it onto the page where you
          like — nudge it, tilt it, let it smudge a little. It&rsquo;s your hand
          on the page.
        </p>
        <p>Then, if the moment&rsquo;s worth keeping, add to it:</p>
        <ul className="ml-5 list-disc space-y-2 marker:text-hairline">
          <li>
            <strong>A few words and a mood.</strong> Jot what the visit was like;
            it saves as you write.
          </li>
          <li>
            <strong>Photos.</strong> Snap one there or add from your library. If
            you&rsquo;re out of signal, it waits and uploads itself once
            you&rsquo;re back online.
          </li>
          <li>
            <strong>Your voice.</strong> Speak the entry instead of typing it.
            The transcribing happens right on your phone — your audio never
            leaves the device — and it becomes text you can tidy up.
          </li>
        </ul>
        <FigureSlot label="placing a stamp and writing a journal entry" />
      </Section>

      <Section title="Your travel record">
        <p>
          Flip past the passport pages and you&rsquo;ll find the back of the
          book: every stop you&rsquo;ve stamped, in the order you visited, with
          your notes and up to a few photos from each. It fills in as you go —
          a quiet log of where you&rsquo;ve been.
        </p>
        <Note>
          These back pages are yours alone. Your journal, your photos, your moods
          — no one else can see them, not other collectors and not the places you
          visit.
        </Note>
      </Section>

      <Section title="Finishing a passport">
        <p>
          Fill in every stop and, if that passport carries a reward, the app
          shows you a <strong>code</strong>. Bring it to the location — read it
          out or show the little QR — and a staff member there will confirm it
          and hand over your prize. That&rsquo;s the whole trip, start to finish.
        </p>
      </Section>
    </article>
  )
}
