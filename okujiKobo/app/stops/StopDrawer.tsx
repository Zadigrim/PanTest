'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconTile } from './IconTile'
import { CommentsSection } from './CommentsSection'
import type { DraftPassport, StopCardData } from './types'

/**
 * Preview drawer — sliding panel from the right.
 *
 * Renders the stop's details, exposes the kudos toggle, and
 * runs the import target picker (existing drafts + "New
 * passport"). No bookmark / save action — the brief gap-listed
 * that as out of scope.
 */
export function StopDrawer({
  open,
  stop,
  drafts,
  canWriteComments,
  onClose,
}: {
  open: boolean
  stop: StopCardData | null
  drafts: DraftPassport[]
  canWriteComments: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [acked,  setAcked]   = useState<boolean>(false)
  const [ackCount, setAckCount] = useState<number>(0)
  const [ackPending, setAckPending] = useState(false)
  const [target, setTarget] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Re-seed local kudos + target state every time the drawer
  // focuses a new stop. The server payload is the source of
  // truth on open; mutations update local state optimistically.
  const focusedId = stop?.id ?? null
  useEffect(() => {
    if (!stop) return
    setAcked(stop.acknowledged_by_me)
    setAckCount(stop.acknowledgment_count)
    setTarget(drafts[0]?.id ?? '__new__')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId])

  if (!open || !stop) return null

  async function handleToggleAck() {
    if (!stop) return
    setAckPending(true)
    setError(null)
    const wasAcked = acked
    // Optimistic.
    setAcked(!wasAcked)
    setAckCount((c) => c + (wasAcked ? -1 : 1))
    try {
      const res = await fetch(`/api/stops/${stop.id}/acknowledge`, {
        method: wasAcked ? 'DELETE' : 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Revert on failure.
        setAcked(wasAcked)
        setAckCount((c) => c + (wasAcked ? 1 : -1))
        setError(body.error ?? 'Acknowledge failed')
      }
    } catch (e) {
      setAcked(wasAcked)
      setAckCount((c) => c + (wasAcked ? 1 : -1))
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAckPending(false)
    }
  }

  async function handleImport() {
    if (!stop) return
    setError(null)
    setImporting(true)
    try {
      let passportId: string | null = null
      if (target === '__new__' || drafts.length === 0) {
        // Create a fresh passport via the create endpoint the
        // designer "new" page uses. The server requires a title;
        // we use a sensible default.
        const createRes = await fetch('/api/passports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Imported · ${stop.name}` }),
        })
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}))
          setError(body.error ?? 'Could not create a new passport')
          return
        }
        const json = await createRes.json() as { id?: string; passport?: { id: string } }
        passportId = json.id ?? json.passport?.id ?? null
        if (!passportId) {
          setError('Created passport but did not receive an id back')
          return
        }
      } else {
        passportId = target
      }
      const importRes = await fetch('/api/stops/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId: stop.id, passportId }),
      })
      if (!importRes.ok) {
        const body = await importRes.json().catch(() => ({}))
        setError(body.error ?? 'Import failed')
        return
      }
      // Navigate to the designer for the target passport.
      router.push(`/design/${passportId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-drawer-title"
        className="absolute right-0 top-0 flex h-full w-[min(400px,100vw)] flex-col overflow-hidden border-l-[2px] border-ink bg-white shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <IconTile classifiers={stop.classifiers} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">
              {stop.experience_type === 'experience' ? 'Event / activity' : 'Location'}
            </p>
            <h2 id="stop-drawer-title" className="text-[17px] font-bold leading-tight text-ink">
              {stop.name}
            </h2>
            <PlaceLine stop={stop} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[14px] text-muted hover:text-ink"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <p role="alert" className="rounded-[6px] border border-red/40 bg-red/5 px-3 py-2 text-[12px] text-red">
              {error}
            </p>
          )}

          {/* Chip row */}
          <Section title="At a glance">
            <div className="flex flex-wrap gap-1.5">
              {stop.subject_areas.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full border-[1.5px] border-blue bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-blue">
                  {humanize(s)}
                </span>
              ))}
              {stop.grade_levels.length > 0 && (
                <span className="rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-ink">
                  {stop.grade_levels.map((g) => g.replace('-', '–')).join(' · ')}
                </span>
              )}
              {stop.classifiers.slice(0, 4).map((c) => (
                <span key={c} className="rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[10px] uppercase tracking-[1px] text-muted">
                  {humanize(c)}
                </span>
              ))}
            </div>
          </Section>

          {/* Stat row */}
          <Section title="Reuse + credit">
            <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-surface-faintdiv">
              <Stat label="Acknowledgments" value={ackCount} />
              <Stat label="Imports" value={stop.import_count} divider />
            </div>
            {/* Revision / version omitted — schema has no
                version column today; surfacing a fake stat
                would be worse than absence. */}
          </Section>

          {/* What's inside */}
          <Section title="What's inside">
            <DetailRow label="Verification">
              <VerificationLine stop={stop} />
            </DetailRow>
            {stop.experience_type !== 'experience' && (stop.address_city || stop.address_state || stop.address_country) && (
              <DetailRow label="Place">
                <span className="text-ink">
                  {[stop.address_city, stop.address_state, stop.address_country].filter(Boolean).join(', ')}
                </span>
              </DetailRow>
            )}
            {stop.learning_objective && (
              <DetailRow label="Learning objective">
                <span className="text-ink">{stop.learning_objective}</span>
              </DetailRow>
            )}
            {stop.journal_prompt && (
              <DetailRow label="Journal prompt">
                <span className="text-ink">{stop.journal_prompt}</span>
              </DetailRow>
            )}
            {/* Standards omitted — schema has no column. */}
          </Section>

          {/* Creator card */}
          <Section title="Creator">
            <div className="rounded-[8px] border border-surface-faintdiv px-3 py-3">
              <p className="text-[13px] font-semibold text-ink">
                {stop.creator_name ?? 'Someone'}
                {stop.institution_name && (
                  <span className="font-normal text-muted"> · {stop.institution_name}</span>
                )}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                {ackCount === 0
                  ? 'Be the first educator to acknowledge this stop.'
                  : `${ackCount} educator${ackCount === 1 ? '' : 's have'} acknowledged this stop${ackCount === 1 ? ' so far' : ''}.`}
              </p>
              <button
                type="button"
                onClick={() => void handleToggleAck()}
                disabled={ackPending}
                aria-pressed={acked}
                className={`mt-2 inline-flex items-center gap-1.5 rounded-[6px] border-[1.5px] px-3 py-1 text-[12px] font-semibold transition-colors ${
                  acked
                    ? 'border-accent bg-accent text-white'
                    : 'border-accent bg-white text-accent hover:bg-accent/10'
                } disabled:opacity-60`}
              >
                {acked ? '✓ Acknowledged' : 'Acknowledge'}
              </button>
            </div>
          </Section>

          {/* Comments — fetched per-stop on drawer focus. Writer-gating
              comes from the page-level canWriteComments prop; RLS is
              the actual enforcement. */}
          <CommentsSection stopId={stop.id} canWrite={canWriteComments} />
        </div>

        {/* Footer — primary import action with target picker */}
        <footer className="border-t border-hairline bg-white px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
            Import to a passport
          </p>
          <div className="flex gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-9 flex-1 rounded-[6px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
            >
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
              <option value="__new__">＋ New passport</option>
            </select>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing}
              className="inline-flex h-9 items-center rounded-[6px] border-[1.5px] border-ink bg-green px-3 text-[12.5px] font-semibold text-white hover:bg-green/90 disabled:opacity-60"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-muted">
            Importing copies this stop into your draft and credits{' '}
            <span className="font-semibold text-ink">{stop.creator_name ?? 'the creator'}</span>.
          </p>
        </footer>
      </aside>
    </div>
  )
}

// ── Sub-components ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[9.5px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
        {title}
      </p>
      <div>{children}</div>
    </section>
  )
}
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">{label}</p>
      <div className="mt-0.5 text-[12.5px] leading-snug">{children}</div>
    </div>
  )
}
function Stat({ label, value, divider = false }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className={`px-3 py-2.5 text-center ${divider ? 'border-l border-surface-faintdiv' : ''}`}>
      <p className="text-[18px] font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">{label}</p>
    </div>
  )
}

function PlaceLine({ stop }: { stop: StopCardData }) {
  if (stop.experience_type === 'experience') {
    return <p className="mt-0.5 text-[11.5px] text-muted">Event or activity — no fixed address.</p>
  }
  const parts = [stop.address_city, stop.address_state].filter(Boolean) as string[]
  if (parts.length === 0) return <p className="mt-0.5 text-[11.5px] italic text-muted">Location TBA</p>
  return <p className="mt-0.5 text-[11.5px] text-muted">{parts.join(', ')}</p>
}

function VerificationLine({ stop }: { stop: StopCardData }) {
  const method = stop.experience_verification_method
  if (!method) return <span className="text-muted">—</span>
  const map: Record<string, string> = {
    gps:        'GPS — check-in at the location',
    qr:         'QR — scan the code at the location',
    witnessed:  'Witnessed — an employee verifies',
    documented: 'Documented — evidence required',
    honor:      'Honor — self-reported',
  }
  return <span className="text-ink">{map[method] ?? method}</span>
}

function humanize(v: string): string {
  return v.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
