import Link from 'next/link'

/**
 * Program Terminal tab. The full employee terminal lives at
 * /terminal (831-line surface with its own gesture / scanning
 * mechanics). The tab is intentionally a launcher panel — embedding
 * it inside a tab would compromise the full-screen UX the terminal
 * needs and re-introduce a duplicate codepath.
 *
 * The tab gives an honest summary of what the terminal does +
 * a single CTA to launch it. No new mechanics here; that's
 * deferred to KI-02.
 */
export function TerminalTab({ pendingDistribution }: { pendingDistribution: number }) {
  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-[10px] border border-surface-faintdiv bg-white px-5 py-5">
        <h2 className="text-[15px] font-semibold text-ink">Employee terminal</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Verify collectors in person, hand out prizes, and mark distributions
          delivered. Runs as its own full-screen surface so staff can use it
          on a counter device.
        </p>
        <Link
          href="/terminal"
          className="mt-4 inline-flex items-center rounded-[8px] border-[1.5px] border-ink bg-green px-4 h-9 text-[13px] font-semibold text-white"
        >
          Launch terminal →
        </Link>
      </section>

      <section
        className={`rounded-[10px] border bg-white px-5 py-5 ${
          pendingDistribution > 0 ? 'border-accent' : 'border-surface-faintdiv'
        }`}
      >
        <h3 className="text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
          Pending distribution
        </h3>
        <p className={`mt-1 text-[24px] font-bold tabular-nums ${pendingDistribution > 0 ? 'text-accent' : 'text-ink'}`}>
          {pendingDistribution}
        </p>
        <p className="mt-1 text-[12px] text-muted">
          {pendingDistribution > 0
            ? <>Collectors waiting on a prize handoff. Launch the terminal to clear the queue.</>
            : <>No prizes waiting to be handed out.</>}
        </p>
      </section>

      <p className="text-[11.5px] text-muted">
        Coming later: terminal events log, per-employee distribution counts, and the
        collector-side redemption record. Until that ships, the terminal records
        distributions on <code className="rounded bg-paper px-1 py-0.5 text-[10.5px]">completion_tokens</code> and the
        counts on this surface use those rows directly.
      </p>
    </div>
  )
}
