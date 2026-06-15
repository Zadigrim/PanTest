'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePassportStore } from '@/lib/design/passport-store'
import { LeftPalette } from '@/components/design/LeftPalette'
import { Canvas } from '@/components/design/Canvas'
import { RightInspector } from '@/components/design/RightInspector'
import { useAutosave } from '@/hooks/useAutosave'
import { retryFailed, saveAll } from '@/lib/design/persist'
import { useWorkspaceKeyboard } from '@/hooks/useWorkspaceKeyboard'
import { Wordmark } from '@/components/moichido/Wordmark'
import { RingMark } from '@/components/moichido/marks/RingMark'
import { usePersistentBool, usePersistentNumber } from '@/components/design/usePersistent'
import { PunchGridContext, PUNCH_GRID_SIZES } from '@/lib/design/punch-grid'
import { CardPunchShape } from './CardPunchShape'
import type { DesignerPassport, DesignerPassportPage, DesignerStop, DesignerPunch } from '@/lib/design/types'

interface Props {
  passport: DesignerPassport
  pages: DesignerPassportPage[]
  stops: DesignerStop[]
  punchSlots: DesignerPunch[]
}

/**
 * Moichido card designer — the WorkspaceClient analogue for the
 * merchant surface. Reuses the okuji designer's INNER three columns
 * (LeftPalette, Canvas, RightInspector) via the shared Zustand store
 * + persist machinery. The credential_type='consumable' branches in
 * those components hide passport-world affordances (verification
 * tier, per-stop stamp, learning fields, share).
 *
 * What lives here that's moichido-specific:
 *   - Brand chrome (Wordmark, Ring mark, teal/apricot tokens)
 *   - Top bar: ← back to /moichido/cards, title (editable), save +
 *     indicator, target-punches input, NO Publish, NO Print, NO Cover
 *   - No Cover/Pages tab strip (Pages live in LeftPalette per
 *     the M4.3 multi-page-card decision)
 *   - Card-level punch-shape picker (one shape per card, propagated
 *     across stops via CardPunchShape)
 *
 * What stays the same as the okuji designer:
 *   - Element/stop authoring, asset handling, save semantics,
 *     keyboard shortcuts, autosave, save-on-back safety net
 *   - Multi-page support — the spec permits info pages alongside
 *     the punch page; LeftPalette's Pages section renders unchanged
 */
export function CardWorkspace({ passport, pages, stops, punchSlots }: Props) {
  const router = useRouter()
  const hydrate = usePassportStore((s) => s.hydrate)
  const isDirty = usePassportStore((s) => s.isDirty)
  const isSaving = usePassportStore((s) => s.isSaving)
  const lastSavedAt = usePassportStore((s) => s.lastSavedAt)
  const saveError = usePassportStore((s) => s.saveError)
  const passportState = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  const [navigating, setNavigating] = useState(false)
  // Snap-to-grid editing aid (designer preference, persisted locally — not
  // stored on the card). Provided to the canvas via PunchGridContext.
  const [gridEnabled, setGridEnabled] = usePersistentBool('moichido.punchGrid.enabled', false)
  const [gridSize, setGridSize] = usePersistentNumber('moichido.punchGrid.size', 24)

  useEffect(() => {
    hydrate(passport, pages, stops, punchSlots)
  }, [passport.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    await saveAll()
  }, [])
  useAutosave()
  useWorkspaceKeyboard({
    onSave: handleSave,
    onSettings: () => {},
  })

  const displayPassport = passportState ?? passport

  async function handleBack() {
    if (navigating) return
    setNavigating(true)
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
    router.push('/moichido/cards')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-moichido-paper">
      {/* Top bar — moichido chrome */}
      <header className="flex shrink-0 items-center justify-between border-b border-moichido-hairline bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={navigating}
            className="flex items-center gap-1.5 text-sm text-moichido-muted hover:text-moichido-ink transition-colors disabled:opacity-50 rounded-sm"
            aria-label="Save and return to cards"
          >
            <span className="text-base">←</span>
            {navigating ? 'Saving…' : 'Cards'}
          </button>
          <span className="text-moichido-hairline">·</span>
          <span className="text-moichido-teal"><RingMark size={18} strokeWidth={2.4} /></span>
          <Wordmark className="text-base text-moichido-teal" />
          <span className="text-moichido-hairline">·</span>
          <input
            type="text"
            value={displayPassport.title}
            onChange={(e) => updatePassport({ title: e.target.value })}
            onBlur={() => saveAll()}
            className="max-w-xs truncate rounded-card border-0 bg-transparent px-1 text-sm font-semibold text-moichido-ink focus:bg-white focus:outline-none focus:ring-1 focus:ring-moichido-teal"
            placeholder="Untitled card"
          />
        </div>

        <div className="flex items-center gap-3">
          <SaveIndicator
            isDirty={isDirty}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            saveError={saveError}
            onRetry={retryFailed}
          />
          <label className="flex items-center gap-1.5 text-xs text-moichido-muted">
            Reward at
            <input
              type="number"
              min={1}
              max={100}
              value={displayPassport.consumable_target_count ?? 10}
              onChange={(e) => {
                const n = Number(e.target.value)
                updatePassport({ consumable_target_count: Number.isFinite(n) && n > 0 ? n : null })
              }}
              onBlur={() => saveAll()}
              className="h-7 w-14 rounded-card border border-moichido-hairline bg-white px-1.5 text-center text-xs text-moichido-ink"
            />
            punches
          </label>
          {/* Snap-to-grid: optional aid for evenly spacing punches. The size
              select only matters when snapping is on. */}
          <label className="flex items-center gap-1.5 text-xs text-moichido-muted">
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={(e) => setGridEnabled(e.target.checked)}
              className="accent-moichido-teal"
            />
            Snap to grid
          </label>
          {gridEnabled && (
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              aria-label="Grid size"
              className="h-7 rounded-card border border-moichido-hairline bg-white px-1.5 text-xs text-moichido-ink"
            >
              {PUNCH_GRID_SIZES.map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="h-7 rounded-card bg-moichido-teal px-3 text-xs font-semibold text-moichido-paper disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* Workspace — three columns, shared inner components. The grid
          preference is provided here so the canvas (and only the moichido
          canvas) can snap punches; the okuji designer never wraps this. */}
      <PunchGridContext.Provider value={{ enabled: gridEnabled, size: gridSize }}>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-60 shrink-0 flex-col overflow-hidden">
            {/* Card-level punch-shape picker above the shared LeftPalette */}
            <div className="border-r border-b border-moichido-hairline bg-white p-3">
              <CardPunchShape />
            </div>
            {/* Shared LeftPalette — Pages + Stops + Elements. The
                isConsumable check in LeftPalette already relabels
                Stops → Punch locations. Pages section stays so
                merchants can add info pages (terms, about). */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LeftPalette />
            </div>
          </div>
          <Canvas />
          <RightInspector creatorInstitutionId={null} />
        </div>
      </PunchGridContext.Provider>
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
  onRetry: () => void
}) {
  let label = 'Saved'
  let tone = 'text-moichido-muted'
  if (saveError) { label = 'Save failed'; tone = 'text-moichido-apricot font-semibold' }
  else if (isSaving) { label = 'Saving…'; tone = 'text-moichido-teal' }
  else if (isDirty)  { label = 'Unsaved changes'; tone = 'text-moichido-apricot' }
  else if (lastSavedAt) {
    const d = new Date(lastSavedAt)
    label = `Saved ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return (
    <span className={`text-xs ${tone}`}>
      {label}
      {saveError && (
        <button type="button" onClick={onRetry} className="ml-2 underline">Retry</button>
      )}
    </span>
  )
}
