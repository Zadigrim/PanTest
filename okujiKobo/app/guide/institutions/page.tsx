import type { Metadata } from 'next'
import { Section, FlagRow, Note, FigureSlot } from '../guide-ui'

// Institutional-administrator guide. Describes the real roster UI
// (/program?tab=employees): add-by-email (existing okuji accounts only, no
// invitations are emailed), the six settable capability flags described by
// what each actually controls today, the genuine aggregate-only analytics, and
// the draft|published|archived passport lifecycle with holder-safe
// unpublish/republish. Deliberately omitted: dormant collector-redemption KPIs
// and the off-in-production dashboard KPI slots.
export const metadata: Metadata = {
  title: 'For institutions — okuji',
  robots: { index: false, follow: false },
}

export default function InstitutionsGuidePage() {
  return (
    <article>
      <h1 className="text-[30px] font-bold text-ink" style={{ letterSpacing: '-0.015em' }}>
        Running your program
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-muted">
        As an administrator you decide who on your team can do what, watch how
        your passports are performing, and manage those passports through their
        life. This is how each of those works.
      </p>

      <Section title="Your team">
        <p>
          Your roster lives under <strong>Program &rarr; Employees</strong>. To
          add someone, enter their email and give them a role label. They&rsquo;ll
          need an okuji account already — the roster looks them up by that email,
          and no invitation is sent on your behalf, so have them sign up first if
          they haven&rsquo;t. Removing someone, or changing what they can do, is a
          toggle away on their row.
        </p>
        <FigureSlot label="the employees roster with permission toggles" />
      </Section>

      <Section title="What each permission does">
        <p>
          Every teammate&rsquo;s access is a set of capability flags. Grant only
          what the role needs:
        </p>
        <div className="mt-4">
          <FlagRow name="can_verify">
            Use the terminal to look up a collector&rsquo;s completion code and
            confirm it. This is the baseline for anyone working a counter.
          </FlagRow>
          <FlagRow name="can_distribute_prizes">
            Mark a prize as handed out at the terminal. Pair it with{' '}
            <code className="text-[13px] text-clay">can_verify</code> for staff
            who actually give rewards to visitors.
          </FlagRow>
          <FlagRow name="can_design">
            Create and edit passports, and publish, unpublish, or remove them.
            This is your design-side permission.
          </FlagRow>
          <FlagRow name="can_manage_employees">
            Manage this roster and handle passport transfers. Give it only to
            people you trust to change others&rsquo; access.
          </FlagRow>
          <FlagRow name="can_view_analytics">
            See your institution&rsquo;s numbers in Program Overview and
            Analytics. Without it, a teammate only sees their own work.
          </FlagRow>
          <FlagRow name="can_manage_billing">
            Change your institution&rsquo;s tier and pricing settings.
          </FlagRow>
        </div>
      </Section>

      <Section title="Your numbers">
        <p>
          Program Overview and Analytics show how your passports are doing:
          active collectors over the last 30 days, acquisitions and stamps placed
          over the last 90, your completion rate, and prizes handed out versus
          still pending. Each is a live count, drawn straight from what&rsquo;s
          actually happening — never a sample or a placeholder.
        </p>
        <Note>
          These numbers are always aggregate: how many, and when. okuji never
          shows you which individual collector did what — no names, no emails, no
          per-person journeys. It&rsquo;s the shape of your program, not
          surveillance of your visitors.
        </Note>
      </Section>

      <Section title="Managing passports">
        <p>A passport moves through three states in its life:</p>
        <ul className="ml-5 list-disc space-y-2 marker:text-hairline">
          <li>
            <strong>Draft</strong> — you&rsquo;re still building it; no one can
            collect it yet.
          </li>
          <li>
            <strong>Published</strong> — it&rsquo;s live and collectors can pick
            it up.
          </li>
          <li>
            <strong>Archived</strong> — retired from view, kept for the record.
          </li>
        </ul>
        <p>
          You can unpublish a live passport back to draft at any time; anyone who
          already holds it keeps it. Once a passport <em>has</em> holders,
          re-publishing changes is handled carefully — corrections go through
          with a note on what changed, so you can&rsquo;t quietly rewrite a
          passport out from under the people collecting it. And a passport can
          only be deleted outright while no one has acquired it; after that, it&rsquo;s
          archived rather than erased, so a collector&rsquo;s record is never
          destroyed.
        </p>
        <p>
          One gate to know about: publishing a <em>personal</em> passport (one
          not owned by an institution) requires Studio. Institutional passports
          publish without it.
        </p>
      </Section>
    </article>
  )
}
