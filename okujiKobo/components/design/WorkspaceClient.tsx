'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePassportStore } from '@/lib/design/passport-store'
import { LeftPalette } from './LeftPalette'
import { Canvas } from './Canvas'
import { RightInspector } from './RightInspector'
import { Resizer } from './Resizer'
import { usePersistentNumber } from './usePersistent'
import { CoverCanvas } from './CoverCanvas'
import { CoverInspector } from './CoverInspector'
import { CoverPalette } from './CoverPalette'
import { PassportSettingsPanel } from './PassportSettingsPanel'
import { PrintOptionsDialog } from './PrintOptionsDialog'
import { PublishFlow } from './PublishFlow'
import { HelpDrawer } from './HelpDrawer'
import { Button } from './ui/Button'
import { useAutosave } from '@/hooks/useAutosave'
import { retryFailed, saveAll } from '@/lib/design/persist'
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
  const router = useRouter()
  const hydrate = usePassportStore((s) => s.hydrate)
  const isDirty = usePassportStore((s) => s.isDirty)
  const isSaving = usePassportStore((s) => s.isSaving)
  const lastSavedAt = usePassportStore((s) => s.lastSavedAt)
  const saveError = usePassportStore((s) => s.saveError)
  const passportState = usePassportStore((s) => s.passport)
  const pageList = usePassportStore((s) => s.pages)
  const activePageId = usePassportStore((s) => s.activePageId)
  const setActivePage = usePassportStore((s) => s.setActivePage)

  const [showSettings, setShowSettings] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [viewMode, setViewMode] = useState<'cover' | 'pages'>('pages')
  const [coverFace, setCoverFace] = useState<CoverFace>('outside')
  const [coverPanel, setCoverPanel] = useState<CoverPanel>('front')
  // Resizable column widths (persisted). Canvas (flex-1) absorbs the rest.
  const [leftW, setLeftW] = usePersistentNumber('okuji.designer.leftW', 240)
  const [rightW, setRightW] = usePersistentNumber('okuji.designer.rightW', 280)

  useEffect(() => {
    hydrate(passport, pages, stops)
  }, [passport.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { institutionId: effectiveInstitutionId } = useEffectiveProfile({ institutionId: creatorInstitutionId })

  // Explicit-save model: edits update the local store; the Save button
  // (and Ctrl/Cmd-S via useWorkspaceKeyboard) call saveAll to persist
  // everything in one pass.
  const handleSave = useCallback(async () => {
    await saveAll()
  }, [])
  useAutosave()
  useCoverThumbnail()
  useWorkspaceKeyboard({
    onSave: handleSave,
    onSettings: () => setShowSettings(true),
  })

  const displayPassport = passportState ?? passport
  const isPublished = displayPassport.status === 'published'

  async function handleBack() {
    if (navigating) return
    setNavigating(true)
    // If the user has unsaved edits, flush them with saveAll before
    // leaving. Saves are otherwise explicit (Save button) — this is
    // just a safety net so backing out doesn't lose work.
    const { isDirty } = usePassportStore.getState()
    if (isDirty) {
      try {
        await saveAll()
      } catch (err) {
        console.error('save-before-navigate failed:', err)
      }
      const err = usePassportStore.getState().saveError
      if (err) {
        const proceed = window.confirm(
          `Your changes could not be saved (${err}). Leave anyway and lose them?`,
        )
        if (!proceed) {
          setNavigating(false)
          return
        }
      }
    }
    router.push('/design')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-workspace">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-hairline bg-surface-chrome px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={navigating}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-sm"
            aria-label="Save and return to My Passports"
          >
            <span className="text-base">←</span>
            {navigating ? 'Saving…' : 'My Passports'}
          </button>
          <span className="text-hairline">·</span>
          <span className="max-w-xs truncate text-sm font-semibold text-navy">
            {displayPassport.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator
            isDirty={isDirty}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            saveError={saveError}
            onRetry={retryFailed}
          />
          <Button
            size="sm"
            variant={isDirty ? 'default' : 'ghost'}
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            aria-label="Save changes"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              displayPassport.status === 'published'
                ? 'bg-cream text-green'
                : displayPassport.status === 'archived'
                ? 'bg-accent/15 text-accent'
                : 'bg-hairline text-muted'
            }`}
          >
            {displayPassport.status}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPrintOpen(true)}
          >
            Print
          </Button>
          <PrintOptionsDialog
            passport={{ id: displayPassport.id, title: displayPassport.title }}
            open={printOpen}
            onOpenChange={setPrintOpen}
          />
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} aria-label="Open help">
            Help
          </Button>
          {!isPublished && (
            <Button size="sm" onClick={() => setShowPublish(true)}>
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* Tabs: Cover + Pages */}
      <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-hairline bg-surface-chrome px-4">
        {/* Cover tab */}
        <button
          onClick={() => setViewMode('cover')}
          className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
            viewMode === 'cover'
              ? 'border-green font-medium text-green'
              : 'border-transparent text-muted hover:text-navy'
          }`}
        >
          Cover
        </button>

        {/* Divider */}
        <span className="mx-1 text-hairline select-none">·</span>

        {/* Page tabs */}
        {pageList.map((page, i) => (
          <button
            key={page.id}
            onClick={() => { setViewMode('pages'); setActivePage(page.id) }}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px ${
              viewMode === 'pages' && page.id === activePageId
                ? 'border-green font-medium text-green'
                : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            {page.section_title ?? page.section_name ?? `Page ${i + 1}`}
          </button>
        ))}
        {pageList.length === 0 && viewMode === 'pages' && (
          <span className="px-3 py-2 text-sm italic text-muted/50">
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
            <LeftPalette width={leftW} />
            <Resizer
              orientation="x"
              ariaLabel="Resize left panel"
              onReset={() => setLeftW(240)}
              onDelta={(d) => setLeftW((w) => Math.min(480, Math.max(180, w + d)))}
            />
            <Canvas />
            <Resizer
              orientation="x"
              ariaLabel="Resize right panel"
              onReset={() => setRightW(280)}
              onDelta={(d) => setRightW((w) => Math.min(560, Math.max(200, w - d)))}
            />
            <RightInspector creatorInstitutionId={effectiveInstitutionId} width={rightW} />
          </>
        )}
      </div>

      {showSettings && <PassportSettingsPanel onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpDrawer onClose={() => setShowHelp(false)} />}
      {showPublish && <PublishFlow onClose={() => setShowPublish(false)} />}
    </div>
  )
}

function SaveIndicator({
  isDirty,
  isSaving,
  lastSavedAt,
  saveError,
  onRetry,
}: {
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  saveError: string | null
  onRetry: () => Promise<void>
}) {
  if (saveError) {
    return (
      <span className="flex items-center gap-2 text-xs text-accent">
        <span title={saveError}>Save failed</span>
        <button
          type="button"
          onClick={() => void onRetry()}
          className="rounded-card border border-accent px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent hover:text-white transition-colors"
        >
          Retry
        </button>
      </span>
    )
  }
  if (isSaving) return <span className="text-xs text-muted">Saving…</span>
  if (isDirty) return <span className="text-xs text-accent">Unsaved changes</span>
  if (lastSavedAt) {
    return (
      <span className="text-xs text-muted">
        Saved{' '}
        {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  return null
}
