'use client'

import { useState, useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PrintJournalSetting } from '@/lib/design/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrintStop {
  id: string
  name: string
  stop_order: number
  journal_prompt: string | null
  print_include_journal: boolean
}

interface PrintPassportModalProps {
  passport: {
    id: string
    title: string
    institution_id: string | null
    print_journal_setting: PrintJournalSetting
  }
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrintPassportModal({ passport, onClose }: PrintPassportModalProps) {
  const copiesId = useId()
  const [stops, setStops] = useState<PrintStop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [copies, setCopies] = useState(25)
  const [journalOverride, setJournalOverride] = useState<'include_all' | 'exclude_all' | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState('')

  // Load stops + institution name on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const supabase = createClient()

        // Fetch institution name
        if (passport.institution_id) {
          const { data: inst } = await supabase
            .from('institutions')
            .select('name')
            .eq('id', passport.institution_id)
            .single()
          if (inst?.name) setInstitutionName(inst.name as string)
        }

        // Pages for this passport
        const { data: pages, error: pagesErr } = await supabase
          .from('passport_pages')
          .select('id')
          .eq('passport_id', passport.id)
        if (pagesErr) throw new Error(pagesErr.message)
        const pageIds = (pages ?? []).map((p: { id: string }) => p.id)

        if (pageIds.length === 0) {
          setStops([])
          return
        }

        // Stops for those pages
        const { data: rawStops, error: stopsErr } = await supabase
          .from('stops')
          .select('id, name, stop_order, journal_prompt, print_include_journal')
          .in('page_id', pageIds)
          .order('stop_order', { ascending: true })
        if (stopsErr) throw new Error(stopsErr.message)

        const loaded: PrintStop[] = (rawStops ?? []).map((s: Record<string, unknown>) => ({
          id:                   s.id as string,
          name:                 s.name as string,
          stop_order:           (s.stop_order as number) ?? 0,
          journal_prompt:       (s.journal_prompt as string | null) ?? null,
          print_include_journal:(s.print_include_journal as boolean) ?? true,
        }))

        setStops(loaded)
        setSelectedIds(new Set(loaded.map((s) => s.id)))
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load stops')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [passport.id])

  function toggleStop(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pagesPerBooklet = selectedIds.size + 2 // cover + stops + cert
  const sheetsPerCopy   = Math.ceil(pagesPerBooklet / 4)
  const totalSheets     = sheetsPerCopy * copies

  async function handleGenerate(mode: 'preview' | 'download') {
    if (selectedIds.size === 0) {
      setGenError('Select at least one stop.')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const orderedIds = stops
        .filter((s) => selectedIds.has(s.id))
        .map((s) => s.id)

      const res = await fetch(`/api/passports/${passport.id}/print-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stop_ids: orderedIds,
          copies,
          journal_override: journalOverride,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (mode === 'preview') {
        window.open(url, '_blank')
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const a = document.createElement('a')
        a.href = url
        a.download = `${passport.title} — Print Passport — ${today}.pdf`
        a.click()
      }

      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-modal border border-hairline bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 className="text-base font-semibold text-navy">Print Physical Passports</h2>
          <button
            onClick={onClose}
            className="text-lg text-muted hover:text-navy transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="space-y-0.5">
            <p className="text-sm text-navy">
              <span className="font-medium">Passport:</span> {passport.title}
            </p>
            <p className="text-sm text-navy">
              <span className="font-medium">Institution:</span> {institutionName}
            </p>
          </div>

          {/* Stop selection */}
          <section>
            <p className="mb-2 text-sm font-medium text-navy">Select stops to include:</p>
            {loading && (
              <p className="text-sm text-muted animate-pulse">Loading stops…</p>
            )}
            {loadError && (
              <p role="alert" className="text-sm text-accent">{loadError}</p>
            )}
            {!loading && !loadError && stops.length === 0 && (
              <p className="text-sm text-muted">No stops found for this passport.</p>
            )}
            {!loading && !loadError && stops.length > 0 && (
              <div className="space-y-2">
                {stops.map((stop, i) => (
                  <label key={stop.id} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(stop.id)}
                      onChange={() => toggleStop(stop.id)}
                      className="h-4 w-4 rounded accent-green"
                    />
                    <span className="text-sm text-navy">
                      <span className="text-muted mr-1">Stop {i + 1} —</span>
                      {stop.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Copies */}
          <section>
            <label htmlFor={copiesId} className="mb-1.5 block text-sm font-medium text-navy">
              Number of copies
            </label>
            <input
              id={copiesId}
              type="number"
              min={1}
              max={999}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="h-9 w-28 rounded-panel border border-hairline px-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-green"
            />
          </section>

          {/* Sheet calculation */}
          {!loading && selectedIds.size > 0 && (
            <div className="rounded-panel bg-cream px-4 py-3">
              <p className="text-sm text-green">
                <span className="font-medium">{pagesPerBooklet}</span>{' '}
                {pagesPerBooklet === 1 ? 'page' : 'pages'} per booklet
                {' · '}
                <span className="font-medium">{sheetsPerCopy}</span>{' '}
                {sheetsPerCopy === 1 ? 'sheet' : 'sheets'} per copy
                {' · '}
                <span className="font-medium">{copies}</span>{' '}
                {copies === 1 ? 'copy' : 'copies'}
              </p>
              <p className="mt-0.5 text-sm text-green/80">
                = <span className="font-semibold">{totalSheets} sheets total</span> — print double-sided
              </p>
            </div>
          )}

          {/* Journal override */}
          <section>
            <p className="mb-2 text-sm font-medium text-navy">Journal lines:</p>
            <div className="space-y-2">
              {(
                [
                  { value: null,           label: 'Use passport settings' },
                  { value: 'include_all',  label: 'Include for all stops' },
                  { value: 'exclude_all',  label: 'Exclude for all stops' },
                ] as { value: typeof journalOverride; label: string }[]
              ).map(({ value, label }) => (
                <label key={String(value)} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="journal_override"
                    checked={journalOverride === value}
                    onChange={() => setJournalOverride(value)}
                    className="accent-green"
                  />
                  <span className="text-sm text-navy">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {genError && (
            <p role="alert" className="text-sm text-accent">{genError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-hairline px-6 py-4">
          <button
            onClick={() => void handleGenerate('preview')}
            disabled={generating || loading || selectedIds.size === 0}
            className="flex-1 rounded-panel border border-hairline bg-white py-2 text-sm font-medium text-navy hover:border-green hover:text-green transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            {generating ? 'Generating…' : 'Preview PDF'}
          </button>
          <button
            onClick={() => void handleGenerate('download')}
            disabled={generating || loading || selectedIds.size === 0}
            className="flex-1 rounded-panel bg-green py-2 text-sm font-medium text-white hover:bg-green transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
