'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePassportStore } from '@/lib/stores/passport-store'
import { LeftPalette } from './LeftPalette'
import { Canvas } from './Canvas'
import { RightInspector } from './RightInspector'
import { PassportSettingsPanel } from './PassportSettingsPanel'
import { Button } from '@/components/ui/button'
import type { Passport, PassportPage, Stop } from '@/lib/supabase/types'

interface Props {
  passport: Passport
  pages: PassportPage[]
  stops: Stop[]
}

export function WorkspaceClient({ passport, pages, stops }: Props) {
  const hydrate = usePassportStore((s) => s.hydrate)
  const isDirty = usePassportStore((s) => s.isDirty)
  const isSaving = usePassportStore((s) => s.isSaving)
  const lastSavedAt = usePassportStore((s) => s.lastSavedAt)
  const passportState = usePassportStore((s) => s.passport)
  const pageList = usePassportStore((s) => s.pages)
  const activePageId = usePassportStore((s) => s.activePageId)
  const setActivePage = usePassportStore((s) => s.setActivePage)

  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    hydrate(passport, pages, stops)
  }, [passport.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayPassport = passportState ?? passport

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-panoply-gray-1">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-panoply-gray-2 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            <span className="text-base">←</span>
            Dashboard
          </Link>
          <span className="text-panoply-gray-2">·</span>
          <span className="max-w-xs truncate text-sm font-semibold text-panoply-navy">
            {displayPassport.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator isDirty={isDirty} isSaving={isSaving} lastSavedAt={lastSavedAt} />
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              displayPassport.status === 'published'
                ? 'bg-panoply-teal-lt text-panoply-teal-dk'
                : displayPassport.status === 'archived'
                ? 'bg-panoply-amber/15 text-panoply-amber'
                : 'bg-panoply-gray-2 text-panoply-gray-3'
            }`}
          >
            {displayPassport.status}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            Settings
          </Button>
        </div>
      </header>

      {/* Page tabs */}
      <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-panoply-gray-2 bg-white px-4">
        {pageList.map((page, i) => (
          <button
            key={page.id}
            onClick={() => setActivePage(page.id)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
              page.id === activePageId
                ? 'border-panoply-teal font-medium text-panoply-teal-dk'
                : 'border-transparent text-panoply-gray-3 hover:text-panoply-navy'
            }`}
          >
            {page.section_title ?? page.section_name ?? `Page ${i + 1}`}
          </button>
        ))}
        {pageList.length === 0 && (
          <span className="px-3 py-2 text-sm text-panoply-gray-3/50 italic">
            Add a page from the left panel
          </span>
        )}
      </div>

      {/* Three-column workspace */}
      <div className="flex min-h-0 flex-1">
        <LeftPalette />
        <Canvas />
        <RightInspector />
      </div>

      {/* Passport settings slide-over */}
      {showSettings && (
        <PassportSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

function SaveIndicator({
  isDirty,
  isSaving,
  lastSavedAt,
}: {
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
}) {
  if (isSaving) return <span className="text-xs text-panoply-gray-3">Saving…</span>
  if (isDirty) return <span className="text-xs text-panoply-amber">Unsaved changes</span>
  if (lastSavedAt) {
    return (
      <span className="text-xs text-panoply-gray-3">
        Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  return null
}
