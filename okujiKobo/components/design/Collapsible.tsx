'use client'

// Minimal default-closed disclosure for the designer inspector. Wraps a list
// in a titled toggle so long rosters (uploads, stamps, built-ins) don't fill
// the panel. Preserves whatever's inside unchanged — purely a show/hide shell.
import { useState, type ReactNode } from 'react'

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-panel border border-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:text-ink"
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-[10px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  )
}
