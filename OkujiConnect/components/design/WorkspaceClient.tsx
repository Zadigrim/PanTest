'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePassportStore } from '@/lib/design/passport-store'
import { LeftPalette } from './LeftPalette'
import { Canvas } from './Canvas'
import { RightInspector } from './RightInspector'
import { CoverCanvas } from './CoverCanvas'
import { CoverInspector } from './CoverInspector'
import { CoverPalette } from './CoverPalette'
import { PassportSettingsPanel } from './PassportSettingsPanel'
import { PublishFlow } from './PublishFlow'
import { PrintPassportModal } from './PrintPassportModal'
import { Button } from './ui/Button'
import { useAutosave } from '@/hooks/useAutosave'
import { useWorkspaceKeyboard } from '@/hooks/useWorkspaceKeyboard'
import { useEffectiveProfile } from '@/hooks/useEffectiveProfile'
import { useCoverThumbnail } from '@/hooks/useCoverThumbnail'
import type { DesignerPassport, DesignerPassportPage, DesignerStop } from '@/lib/design/types'
import type { CoverFace, CoverPanel } from './CoverCanvas'

interface Props {
  passport: DesignerPassport
  pages: DesignerPassportPage[]
  stops: DesignerStop[]
  creatorInstitutionId: string | null
}

export function WorkspaceClient({ passport, pages, stops, creatorInstitutionId }: Props) {
  const hydrate = usePassportStore((s) => s.hydrate)
  const isDirty = usePassportStore((s) => s.isDirty)
  const isSaving = usePassportStore((s) => s.isSaving)
  const lastSavedAt = usePassportStore((s) => s.lastSavedAt)
  const passportState = usePassportStore((s) => s.passport)
  const pageList = usePassportStore((s) => s.pages)
  const activePageId = usePassportStore((s) => s.activePageId)
  const setActivePage = usePassportStore((s) => s.setActivePage)

  const [showSettings, setShowSettings] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [viewMode, setViewMode] = useState<'cover' | 'pages'>('pages')
  const [coverFace, setCoverFace] = useState<CoverFace>('outside')
  const [coverPanel, setCoverPanel] = useState<CoverPanel>('front')

  useEffect(() => {
    hydrate(passport, pages, stops)
  }, [passport.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { institutionId: effectiveInstitutionId } = useEffectiveProfile({ institutionId: creatorInstitutionId })

  const { saveNow } = useAutosave()
  useCoverThumbnail()
  useWorkspaceKeyboard({
    onSave: saveNow,
    onSettings: () => setShowSettings(true),
  })

  const displayPassport = passportState ?? passport
  const isPublished = displayPassport.status === 'published'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-okuji-gray-1">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-okuji-gray-2 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/design"
            className="flex items-center gap-1.5 text-sm text-okuji-gray-3 hover:text-okuji-navy transition-colors"
          >
            <span className="text-base">←</span>
            My Passports
          </Link>
          <span className="text-okuji-gray-2">·</span>
          <span className="max-w-xs truncate text-sm font-semibold text-okuji-navy">
            {displayPassport.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator isDirty={isDirty} isSaving={isSaving} lastSavedAt={lastSavedAt} />
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              displayPassport.status === 'published'
                ? 'bg-okuji-teal-lt text-okuji-teal-dk'
                : displayPassport.status === 'archived'
                ? 'bg-okuji-amber/15 text-okuji-amber'
                : 'bg-okuji-gray-2 text-okuji-gray-3'
            }`}
          >
            {displayPassport.status}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShowPrint(true)}>
            Print…
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            Settings
          </Button>
          {!isPublished && (
            <Button size="sm" onClick={() => setShowPublish(true)}>
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* Tabs: Cover + Pages */}
      <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-okuji-gray-2 bg-white px-4">
        {/* Cover tab */}
        <button
          onClick={() => setViewMode('cover')}
          className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
            viewMode === 'cover'
              ? 'border-okuji-teal font-medium text-okuji-teal-dk'
              : 'border-transparent text-okuji-gray-3 hover:text-okuji-navy'
          }`}
        >
          Cover
        </button>

        {/* Divider */}
        <span className="mx-1 text-okuji-gray-2 select-none">·</span>

        {/* Page tabs */}
        {pageList.map((page, i) => (
          <button
            key={page.id}
            onClick={() => { setViewMode('pages'); setActivePage(page.id) }}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
              viewMode === 'pages' && page.id === activePageId
                ? 'border-okuji-teal font-medium text-okuji-teal-dk'
                : 'border-transparent text-okuji-gray-3 hover:text-okuji-navy'
            }`}
          >
            {page.section_title ?? page.section_name ?? `Page ${i + 1}`}
          </button>
        ))}
        {pageList.length === 0 && viewMode === 'pages' && (
          <span className="px-3 py-2 text-sm italic text-okuji-gray-3/50">
            Add a page from the left panel
          </span>
        )}
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {viewMode === 'cover' ? (
          <>
            <CoverPalette face={coverFace} />
            <CoverCanvas
              face={coverFace}
              onFaceChange={setCoverFace}
              selectedPanel={coverPanel}
              onPanelChange={setCoverPanel}
            />
            <CoverInspector face={coverFace} panel={coverPanel} />
          </>
        ) : (
          <>
            <LeftPalette />
            <Canvas />
            <RightInspector creatorInstitutionId={effectiveInstitutionId} />
          </>
        )}
      </div>

      {showSettings && <PassportSettingsPanel onClose={() => setShowSettings(false)} />}
      {showPublish && <PublishFlow onClose={() => setShowPublish(false)} />}
      {showPrint && (
        <PrintPassportModal
          passport={{
            id: displayPassport.id,
            title: displayPassport.title,
            institution_id: displayPassport.institution_id ?? null,
            print_journal_setting: displayPassport.print_journal_setting ?? 'include_all',
          }}
          onClose={() => setShowPrint(false)}
        />
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
  if (isSaving) return <span className="text-xs text-okuji-gray-3">Saving…</span>
  if (isDirty) return <span className="text-xs text-okuji-amber">Unsaved changes</span>
  if (lastSavedAt) {
    return (
      <span className="text-xs text-okuji-gray-3">
        Saved{' '}
        {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  return null
}
