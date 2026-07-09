'use client'

// Controlled print-options modal. One deliberate choice — "Show stamp
// previews" — then generate the PDF.
//
//   OFF (default) → blank location boxes for collectors to physically
//                   stamp into.
//   ON            → each stop's stamp image (SVG / PNG / JPG / emoji)
//                   renders inside its box, so the creator can preview
//                   how the passport looks once stamped.
//
// The toggle maps to the print-pdf route's `show_stamps` flag. This is
// the reusable piece; callers own the trigger and the open state.

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { downloadPrintPdf } from '@/lib/print/download'

interface Props {
  passport: { id: string; title: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The two production paths, labeled by PURPOSE (not internal mode name).
// 'booklet' = the home-printer imposed cut/fold/staple PDF (route default).
// 'trim'    = single-leaf pages at 88×125 trim + 3 mm bleed + crop marks, for
//             a print shop to bind — NOT a fold-at-home booklet.
const FORMATS: { value: 'booklet' | 'trim'; title: string; blurb: string }[] = [
  { value: 'booklet', title: 'Classroom booklet', blurb: 'Print at home, fold & staple into a passport.' },
  { value: 'trim', title: 'Keepsake / print-shop', blurb: 'Single pages at trim size + bleed, for professional binding.' },
]

export function PrintOptionsDialog({ passport, open, onOpenChange }: Props) {
  const [format, setFormat] = useState<'booklet' | 'trim'>('booklet')
  const [showStamps, setShowStamps] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (pending) return
    setPending(true)
    setError(null)
    const result = await downloadPrintPdf(passport.id, passport.title, showStamps, format)
    setPending(false)
    if (result.ok) onOpenChange(false)
    else setError(result.error)
  }

  // Reset transient state each time the modal opens so a prior error or
  // toggle doesn't carry over. Block close mid-generation.
  function handleOpenChange(next: boolean) {
    if (next) {
      setFormat('booklet')
      setShowStamps(false)
      setError(null)
    }
    if (!pending) onOpenChange(next)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-modal bg-white p-5 shadow-xl"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-base font-semibold text-navy">
            Print passport
          </Dialog.Title>
          <p className="mt-1 text-xs text-muted">
            Generates a print-ready PDF with every stop included.
          </p>

          {/* Output format — the two production paths, chosen by purpose. */}
          <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Print format">
            {FORMATS.map((f) => {
              const active = format === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormat(f.value)}
                  className={`flex items-start gap-3 rounded-card border p-3 text-left transition-colors ${
                    active ? 'border-green bg-green/5' : 'border-hairline hover:border-green'
                  }`}
                >
                  <span className={`mt-0.5 h-4 w-4 flex-none rounded-full border-2 ${active ? 'border-green bg-green' : 'border-hairline'}`} />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-navy">{f.title}</span>
                    <span className="text-xs text-muted">{f.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-card border border-hairline p-3 hover:border-green transition-colors">
            <input
              type="checkbox"
              checked={showStamps}
              onChange={(e) => setShowStamps(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-navy">Show stamp previews</span>
              <span className="text-xs text-muted">
                Render each stop&apos;s stamp image inside its box, so you can see how the
                passport looks when stamped. Leave off to print blank boxes for collecting.
              </span>
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-panel border border-accent/30 bg-cream px-3 py-2 text-xs text-accent"
            >
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={pending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button variant="default" size="sm" disabled={pending} onClick={handleGenerate}>
              {pending ? 'Generating…' : 'Print'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
