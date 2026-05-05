'use client'

import { useState } from 'react'
import { PrintPassportModal } from './PrintPassportModal'
import type { PrintJournalSetting } from '@/lib/design/types'

interface Props {
  passport: {
    id: string
    title: string
    institution_id: string
    print_journal_setting: PrintJournalSetting
  }
}

export function PrintPassportButton({ passport }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 py-2 text-sm font-medium text-panoply-navy hover:border-panoply-teal hover:bg-panoply-teal-lt hover:text-panoply-teal-dk transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
      >
        <span aria-hidden="true">🖨</span>
        Print for kids…
      </button>
      {open && (
        <PrintPassportModal passport={passport} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
