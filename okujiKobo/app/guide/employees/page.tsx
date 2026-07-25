import type { Metadata } from 'next'
import { Section, Step, Note, FigureSlot } from '../guide-ui'

// Location-staff guide. Written for someone at a counter mid-shift: the primary
// (and only confirmed-working) surface is the web kobo terminal at /terminal —
// look up a collector's completion code (typed or QR-scanned), confirm, and
// record the prize as distributed or pending. Deliberately omitted: prize
// stock/inventory (never modeled — redemption only flags the token), the
// terminal's UI-only experience-stop checkboxes, and mobile Field mode (its
// witnessed-stamp loop is dormant end-to-end today).
export const metadata: Metadata = {
  title: 'For location staff — okuji',
  robots: { index: false, follow: false },
}

export default function EmployeesGuidePage() {
  return (
    <article>
      <h1 className="text-[30px] font-bold text-ink" style={{ letterSpacing: '-0.015em' }}>
        Handing out prizes at the terminal
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-muted">
        When a collector finishes an okuji passport, they earn a reward to pick
        up from you. Your whole job at the counter is: check their code, confirm
        it, hand over the prize. This takes about fifteen seconds. Here it is,
        step by step.
      </p>

      <Section title="Before your shift">
        <p>
          You verify collectors on the <strong>okuji terminal</strong> — a web
          page you open in the venue&rsquo;s browser and sign in to. If it says
          access denied, your manager needs to switch on your terminal access
          (<code className="text-[13px] text-clay">can_verify</code>), plus
          permission to hand prizes out
          (<code className="text-[13px] text-clay">can_distribute_prizes</code>).
          Once you&rsquo;re in, leave it open on the counter for the shift.
        </p>
        <FigureSlot label="the terminal home screen" />
      </Section>

      <Section title="When a collector shows you a code">
        <div className="space-y-6">
          <Step n={1} title="Take the code">
            <p>
              The collector will either read you a code that looks like{' '}
              <code className="text-[13px] text-clay">MCM-XXXX-XX</code> or show a
              QR on their phone. To type it, key it into the box and submit —
              it&rsquo;s not case-sensitive.
            </p>
          </Step>
          <Step n={2} title="Or scan it">
            <p>
              Prefer the camera? Tap <strong>Open camera scanner</strong>, point
              it at their QR, and it reads the code for you. If the camera
              won&rsquo;t start, the terminal just tells you to type the code
              instead — either way gets you to the same place.
            </p>
          </Step>
          <Step n={3} title="Confirm what you see">
            <p>
              The screen shows the collector&rsquo;s first name, a{' '}
              <strong>completion confirmed</strong> check, and the{' '}
              <strong>prize to give them</strong>. The prize is set by management
              — you don&rsquo;t change it, you just read it and hand it over.
            </p>
          </Step>
          <Step n={4} title="Hand it out">
            <p>
              Give them the prize and tap <strong>Distributed</strong>. If you
              can&rsquo;t fulfil it right now — out of stock, wrong counter — tap{' '}
              <strong>Pending</strong> instead so it&rsquo;s on record and someone
              can finish it later. Either way, you&rsquo;re done.
            </p>
          </Step>
        </div>
        <FigureSlot label="a confirmed code with the prize to hand out" />
      </Section>

      <Section title="If a code won't go through">
        <p>The terminal will tell you why. The three you&rsquo;ll see:</p>
        <ul className="ml-5 list-disc space-y-2 marker:text-hairline">
          <li>
            <strong>Already redeemed.</strong> This code was used before. There&rsquo;s
            no override — a prize is handed out once.
          </li>
          <li>
            <strong>Not found.</strong> The code was mistyped or isn&rsquo;t one of
            ours. Ask them to read it again, or scan the QR.
          </li>
          <li>
            <strong>Expired.</strong> The reward window has closed. Nothing to do
            at the counter; send them to whoever runs the program.
          </li>
        </ul>
        <Note>
          You only ever mark that a prize was given — the terminal doesn&rsquo;t
          track stock levels, and it never shows you anyone&rsquo;s personal
          collection or journal. Just the code and the prize.
        </Note>
      </Section>
    </article>
  )
}
