'use client'

// Standalone Print trigger: a button that opens the shared
// PrintOptionsDialog. The dialog owns the "Show stamp previews" option
// and the PDF generation; this component is just the entry button (two
// style variants — full-width for panels, compact pill for toolbars).

import { useState } from 'react'
import { PrintOptionsDialog } from './PrintOptionsDialog'

interface Props {
  passport: {
    id: string
    title: string
    institution_id: string | null
  }
  /** Compact icon-button variant for card footers and toolbars. */
  compact?: boolean
}

const PrinterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)

export function PrintPassportButton({ passport, compact = false }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-panel border border-hairline px-2.5 py-1.5 text-xs font-medium text-muted hover:border-green hover:text-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <PrinterIcon />
          Print
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-panel border border-hairline bg-paper py-2 text-sm font-medium text-navy hover:border-green hover:bg-cream hover:text-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <PrinterIcon />
          Print for kids
        </button>
      )}
      <PrintOptionsDialog passport={passport} open={open} onOpenChange={setOpen} />
    </>
  )
}
