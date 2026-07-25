// Shared presentational primitives for the /guide/* instructional pages.
//
// These are pure layout/typography helpers — no data fetching, no state — so
// the three guides (adventurers / employees / institutions) share one calm,
// on-brand reading system built only from the canonical kobo tokens
// (ink / paper / cream / muted / hairline / accent) in tailwind.config.ts.
// There is no @tailwindcss/typography plugin in this app, so text is styled
// with explicit classes here rather than a `prose` wrapper.
import type { ReactNode } from 'react'

// A titled content section with a hairline rule under the heading.
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-hairline pb-2 text-[19px] font-semibold text-ink" style={{ letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink/90">{children}</div>
    </section>
  )
}

// A numbered step for the task-oriented (employees) flow. The number sits in a
// small accent chip so a staffer mid-shift can scan the sequence at a glance.
export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        aria-hidden
        className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-program-pill bg-accent/15 text-[13px] font-semibold text-ink"
      >
        {n}
      </div>
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <div className="text-[15px] leading-relaxed text-ink/90">{children}</div>
      </div>
    </div>
  )
}

// One capability-flag row for the institutions guide: the flag name in mono,
// then plain-language description of what it actually controls today.
export function FlagRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-hairline/60 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <code className="text-[13px] font-medium text-clay">{name}</code>
      <p className="text-[15px] leading-relaxed text-ink/90">{children}</p>
    </div>
  )
}

// A quiet aside — used for the privacy / honest-data promises. Left accent rule,
// no fill, per the brand's flat, hairline-led style.
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 border-l-2 border-accent bg-cream/50 px-4 py-3 text-[14px] leading-relaxed text-muted">
      {children}
    </div>
  )
}

// Placeholder figure slot for v1 (no images yet). Renders a dashed frame with
// the intended caption so the layout is real and the TODO is visible in-page.
export function FigureSlot({ label }: { label: string }) {
  return (
    <figure className="mt-5">
      <div className="flex min-h-[160px] items-center justify-center rounded-panel border border-dashed border-hairline bg-paper/60 px-4 text-center">
        {/* TODO(guide-art): replace with real screenshot/illustration in v2 */}
        <span className="text-[12px] uppercase tracking-wide text-muted">figure — {label}</span>
      </div>
    </figure>
  )
}
