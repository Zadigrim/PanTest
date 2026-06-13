'use client'

import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { safeUpdate } from '@/lib/design/persist'
import { Button } from './ui/Button'
import type {
  DesignerStop,
  DesignerPassportPage,
  DesignerPageElement,
  PageElementType,
  PageType,
} from '@/lib/design/types'

// ── Page type picker modal ─────────────────────────────────────────────────────

function PageTypePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (type: PageType) => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-panel border border-hairline bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-navy">What kind of page is this?</h2>
        <p className="mb-5 text-xs text-muted">Choose a page type to continue.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('stamp')}
            className="flex flex-col items-start gap-1.5 rounded-panel border-2 border-hairline p-4 text-left transition-colors hover:border-green hover:bg-cream"
          >
            <span className="text-2xl">📮</span>
            <span className="text-sm font-semibold text-navy">Stamp page</span>
            <span className="text-xs text-muted leading-relaxed">
              Has location boxes for collecting stamps
            </span>
          </button>
          <button
            onClick={() => onSelect('information')}
            className="flex flex-col items-start gap-1.5 rounded-panel border-2 border-hairline p-4 text-left transition-colors hover:border-green hover:bg-cream"
          >
            <span className="text-2xl">📄</span>
            <span className="text-sm font-semibold text-navy">Information page</span>
            <span className="text-xs text-muted leading-relaxed">
              Text, images, and decorative elements only
            </span>
          </button>
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full text-xs text-muted hover:text-navy transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── SortablePage ───────────────────────────────────────────────────────────────

function SortablePage({
  page,
  index,
  isActive,
  onSelect,
  onDelete,
}: {
  page: DesignerPassportPage
  index: number
  isActive: boolean
  onSelect: () => void
  /** Per-row delete affordance. Hidden when only one page remains
   *  (every passport needs at least one page; deleting the last
   *  would leave an empty passport). */
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-center gap-1.5 rounded-card text-sm transition-colors ${
        isActive
          ? 'bg-cream font-medium text-green'
          : 'text-muted hover:bg-paper hover:text-navy'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-none px-1 py-1.5 cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </button>
      {/* Page selector */}
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 text-left"
      >
        <span className="text-xs flex-none" aria-hidden="true">
          {page.page_type === 'information' ? '📄' : '📮'}
        </span>
        <span className="truncate">
          {page.section_title ?? page.section_name ?? `Page ${index + 1}`}
        </span>
      </button>
      {/* Delete affordance — hidden when no handler is provided
          (caller suppresses for last-remaining page). The actual
          confirmation lives in the caller so it can name what
          would be lost. */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex-none px-2 py-1 mr-1 text-base leading-none text-muted hover:text-red hover:bg-paper rounded"
          aria-label={`Delete ${page.section_title ?? page.section_name ?? `page ${index + 1}`}`}
          title="Delete page"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── LeftPalette ────────────────────────────────────────────────────────────────

export function LeftPalette() {
  const passport = usePassportStore((s) => s.passport)
  const pages = usePassportStore((s) => s.pages)
  const activePageId = usePassportStore((s) => s.activePageId)
  const setActivePage = usePassportStore((s) => s.setActivePage)
  const addPage = usePassportStore((s) => s.addPage)
  const removePage = usePassportStore((s) => s.removePage)
  const addStop = usePassportStore((s) => s.addStop)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const addElement = usePassportStore((s) => s.addElement)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)

  const reorderPages = usePassportStore((s) => s.reorderPages)
  const [addingStop, setAddingStop] = useState(false)
  const [addingPage, setAddingPage] = useState(false)
  const [showPageTypePicker, setShowPageTypePicker] = useState(false)

  const activePage = pages.find((p) => p.id === activePageId)
  const isInfoPage = activePage?.page_type === 'information'
  // Relabel a handful of affordances when this is a loyalty card so
  // the chrome matches the model (punch / punch location vs stamp /
  // stop). Backend semantics live on credential_type already; this
  // is purely a labeling concern.
  const isConsumable = passport?.credential_type === 'consumable'
  const stopLabel  = isConsumable ? 'punch location' : 'stop'
  const stopsLabel = isConsumable ? 'Punch locations' : 'Stops'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(pages, oldIndex, newIndex)
    const orderedIds = newOrder.map((p) => p.id)
    reorderPages(orderedIds)
    // Persist via the dedicated reorder route — see the route's
    // file-level comment for why per-row UPDATEs from the store
    // collide on UNIQUE(passport_id, page_order). On failure roll
    // the local state back so the UI matches the DB.
    if (!passport) return
    const res = await fetch('/api/passport_pages/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passport_id: passport.id, ordered_ids: orderedIds }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      window.alert(body.error ?? 'Reorder failed — refresh and try again')
      // Roll back to original order.
      reorderPages(pages.map((p) => p.id))
    }
  }, [pages, reorderPages, passport])

  // Delete handler — calls the new API which branches on
  // acquisition count: hard delete for zero-acq, soft-close
  // for has-acq. The "typed confirmation naming what's lost"
  // guardrail is enforced server-side via confirm_stamp_count;
  // the client surfaces what would be lost (stamp count, stop
  // count) so the user knows before agreeing.
  //
  // PRE-FETCH: count stamps on the page's stops so the
  // confirmation prompt is honest. If zero stamps, a single
  // confirm() is enough; if non-zero, the user has to type
  // the page name to acknowledge the loss.
  const handleDeletePage = useCallback(async (page: DesignerPassportPage) => {
    if (!passport) return
    if (pages.length <= 1) {
      window.alert('A passport needs at least one page. Add another page before deleting this one.')
      return
    }
    const pageLabel = page.section_title ?? page.section_name ?? 'this page'

    // Pre-fetch stamp count so the confirm prompt is honest.
    const db = createClient() as any
    const { data: stopsOnPage } = await db
      .from('stops')
      .select('id')
      .eq('page_id', page.id)
    const stopIds = ((stopsOnPage ?? []) as { id: string }[]).map((s) => s.id)
    let stampCount = 0
    if (stopIds.length > 0) {
      const { count } = await db
        .from('stamps')
        .select('id', { count: 'exact', head: true })
        .in('stop_id', stopIds)
      stampCount = count ?? 0
    }

    if (stampCount > 0) {
      const typed = window.prompt(
        `Deleting "${pageLabel}" will permanently remove ${stampCount} test stamp${stampCount === 1 ? '' : 's'} on this page.\n\n`
        + `Type the page name to confirm:\n\n${pageLabel}`,
      )
      if (typed?.trim() !== pageLabel) return
    } else {
      if (!window.confirm(`Delete "${pageLabel}" and its ${stopIds.length} stop${stopIds.length === 1 ? '' : 's'}?`)) return
    }

    const res = await fetch(`/api/passport_pages/${page.id}`, {
      method: 'DELETE',
      headers: stampCount > 0 ? { 'Content-Type': 'application/json' } : undefined,
      body: stampCount > 0 ? JSON.stringify({ confirm_stamp_count: stampCount }) : undefined,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      window.alert(body?.detail ?? body?.error ?? 'Delete failed')
      return
    }
    removePage(page.id)
  }, [passport, pages, removePage])

  // Insert-at-position handler — POST /api/passport_pages with
  // target_position. The route shifts subsequent active pages
  // up by 1 and inserts. Used by the + buttons between pages.
  const handleInsertAt = useCallback(async (position: number, pageType: PageType) => {
    if (!passport) return
    setAddingPage(true)
    const res = await fetch('/api/passport_pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passport_id: passport.id,
        page_type: pageType,
        target_position: position,
      }),
    })
    setAddingPage(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; detail?: string }
      window.alert(body.detail ?? body.error ?? 'Could not insert page')
      return
    }
    // After insert, every shifted page's page_order changed
    // server-side; the simplest reconciliation is to refetch via
    // the existing store path. addPage on the new row + a
    // page_order resync — but we don't have a reload helper here.
    // Pragmatic: optimistically addPage; the next saveAll/load
    // resyncs. The new page's page_order reflects the server's
    // value so subsequent renders are correct.
    const data = await res.json() as DesignerPassportPage
    addPage(data)
  }, [passport, addPage])

  const handleAddStop = async () => {
    if (!activePageId || !passport || isInfoPage) return
    setAddingStop(true)
    const db = createClient() as any
    const existingCount = usePassportStore
      .getState()
      .stops.filter((s) => s.page_id === activePageId).length
    const { data, error } = await db
      .from('stops')
      .insert({
        page_id: activePageId,
        stop_order: existingCount,
        name: 'New Stop',
        stamp_icon: '📍',
        stamp_color: '1D9E75',
        box_x: 40 + (existingCount % 4) * 130,
        box_y: 40 + Math.floor(existingCount / 4) * 130,
        box_width: 120,
        box_height: 120,
        verification_tier: 5,
        verification_radius_meters: 100,
        stamp_rotation_min: -15,
        stamp_rotation_max: 15,
        smudge_intensity: 'none',
      })
      .select()
      .single()

    setAddingStop(false)
    if (!error && data) {
      addStop(data as DesignerStop)
      setSelectedStop(data.id)
    }
  }

  const handleAddElement = async (type: PageElementType) => {
    if (!activePageId) return
    const id =
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2)

    let defaults: DesignerPageElement
    if (type === 'text') {
      defaults = {
        id, type,
        x: 40, y: 40, width: 200, height: 28,
        content: 'Section Header',
        fontSize: 16, fontWeight: 'bold', color: '0D1B2A', align: 'left', rotation: 0,
      }
    } else if (type === 'richtext') {
      // Pre-fill from the first stop on this page that has any address
      // fields. If none, the block opens empty — the inspector still
      // offers a "Pull stop address" affordance once the designer picks
      // a stop. Pre-fill is the common path: per Nathan, "include the
      // address by default, then let them style + add to it".
      const stopsOnPage = usePassportStore
        .getState()
        .stops.filter((s) => s.page_id === activePageId)
      const firstWithAddress = stopsOnPage.find((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = s as any
        return x.address_street || x.address_city || x.address_state || x.address_zip
      }) ?? null
      const { stopAddressToRuns } = await import('@/lib/design/rich-text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seed = stopAddressToRuns(firstWithAddress as any)
      defaults = {
        id, type,
        x: 40, y: 40, width: 240, height: 80,
        runs: seed.length > 0 ? seed : [{ text: 'Address line 1\nCity, ST 00000' }],
        fontSize: 13, fontFamily: 'Arial, sans-serif',
        color: '0D1B2A', align: 'left', rotation: 0,
        linkedStopId: firstWithAddress?.id ?? null,
      }
    } else if (type === 'line') {
      defaults = { id, type, x1: 40, y1: 100, x2: 572, y2: 100, thickness: 2, lineColor: '0D1B2A' }
    } else if (type === 'image') {
      defaults = { id, type, x: 40, y: 40, width: 200, height: 200, imageUrl: '', rotation: 0, opacity: 100 }
    } else if (type === 'layout') {
      // Native size of the ticket layouts (532 wide in the 612-space).
      // Height matches the 3-row variant; the designer resizes to fit
      // the variant actually picked in the inspector.
      defaults = { id, type, x: 40, y: 40, width: 532, height: 298, imageUrl: '', rotation: 0, opacity: 100 }
    } else {
      return
    }

    addElement(activePageId, defaults)
    setSelectedElement(id)
    // The page's elements jsonb persists when the user clicks Save.
  }

  const handleAddPage = () => {
    if (!passport) return
    setShowPageTypePicker(true)
  }

  const handlePageTypeSelected = async (pageType: PageType) => {
    setShowPageTypePicker(false)
    if (!passport) return
    setAddingPage(true)
    // CREATE goes through the server route so the 12-page trial cap
    // (DEC-03 / BLD-06) is enforced server-side. The debounced
    // UPDATE path (lib/design/persist.ts) stays direct via the
    // Supabase JS client — only CREATE flows through this route.
    const res = await fetch('/api/passport_pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passport_id: passport.id,
        page_type: pageType,
      }),
    })
    setAddingPage(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as {
        error?: string; detail?: string; pagesUsed?: number; pagesCap?: number
      }
      console.error('[add-page] insert failed:', body)
      const msg = body.detail ?? body.error ?? 'Could not create page'
      alert(msg)
      return
    }
    const data = await res.json() as DesignerPassportPage
    if (data) {
      addPage(data)
    }
  }

  return (
    <>
      {showPageTypePicker && (
        <PageTypePicker
          onSelect={handlePageTypeSelected}
          onCancel={() => setShowPageTypePicker(false)}
        />
      )}

      <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface-rail">
        {/* Passport meta */}
        <div className="border-b border-hairline px-4 py-3">
          <p className="truncate text-xs font-semibold text-navy">
            {passport?.title ?? 'Loading…'}
          </p>
          <p className="mt-0.5 text-xs text-muted capitalize">
            {passport?.status ?? 'draft'}
          </p>
        </div>

        {/* Pages list — sortable by drag */}
        <div className="border-b border-hairline px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
            Pages
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* Scrollable, drag-resizable (resize-y handle bottom-right)
                  so many pages don't crowd out Stops/Elements. */}
              <div className="space-y-0.5 max-h-64 min-h-[2.5rem] overflow-y-auto resize-y pr-1">
                {pages.map((page, i) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    index={i}
                    isActive={page.id === activePageId}
                    onSelect={() => setActivePage(page.id)}
                    onDelete={pages.length > 1 ? () => void handleDeletePage(page) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 w-full text-xs"
            onClick={handleAddPage}
            disabled={addingPage || !passport}
          >
            {addingPage ? 'Adding…' : '+ Add page'}
          </Button>
        </div>

        {/* Stops / Punch locations — only on stamp pages */}
        {!isInfoPage && (
          <div className="border-b border-hairline px-3 py-2">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              {stopsLabel}
            </p>
            {/* Scrollable + drag-resizable when there are many stops. */}
            <div className="max-h-64 min-h-[2.5rem] overflow-y-auto resize-y pr-1">
              <StopsList />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 w-full text-xs"
              onClick={handleAddStop}
              disabled={addingStop || !activePageId}
            >
              {addingStop ? 'Adding…' : `+ Add ${stopLabel}`}
            </Button>
          </div>
        )}

        {/* Page elements — fills the remaining rail height and scrolls.
            min-h-0 lets this flex child shrink below its content so it
            scrolls instead of pushing the rail when Pages/Stops are tall. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
            {isInfoPage ? 'Content elements' : 'Elements'}
          </p>
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('text')}
              disabled={!activePageId}
            >
              <span className="font-bold">T</span> Add text block
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('richtext')}
              disabled={!activePageId}
              title="Multi-line wrapping text. Pre-fills with the page stop's address; bold / italic / underline on selection."
            >
              <span>¶</span> Add address / paragraph
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('image')}
              disabled={!activePageId}
            >
              <span>🖼</span> Add image
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('layout')}
              disabled={!activePageId}
              title="Thin-lined table/grid art for organizing stamps. Sits over the page background; stops and stamps render on top."
            >
              <span>▦</span> Add layout
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('line')}
              disabled={!activePageId}
            >
              <span>╱</span> Add line
            </Button>
          </div>
          <ElementsList pageId={activePageId} />
        </div>
      </aside>
    </>
  )
}

function StopsList() {
  const stops = usePassportStore(
    useShallow((s) => s.stops.filter((st) => st.page_id === s.activePageId)),
  )
  const selectedStopId = usePassportStore((s) => s.selectedStopId)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)

  if (stops.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted">No stops yet</p>
    )
  }

  return (
    <div className="space-y-0.5">
      {stops.map((stop) => (
        <button
          key={stop.id}
          onClick={() => setSelectedStop(stop.id)}
          className={`flex w-full items-center gap-2 rounded-card px-3 py-1.5 text-left text-sm transition-colors ${
            stop.id === selectedStopId
              ? 'bg-cream font-medium text-green'
              : 'text-muted hover:bg-paper hover:text-navy'
          }`}
        >
          <span className="text-base leading-none">{stop.stamp_icon ?? '📍'}</span>
          <span className="truncate">{stop.name}</span>
        </button>
      ))}
    </div>
  )
}

function ElementsList({ pageId }: { pageId: string | null }) {
  const elements = usePassportStore(
    useShallow((s) => {
      if (!pageId) return []
      return s.pages.find((p) => p.id === pageId)?.elements ?? []
    }),
  )
  const selectedElementId = usePassportStore((s) => s.selectedElementId)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)

  if (elements.length === 0) return null

  const typeIcon = (type: string) => {
    if (type === 'text')     return 'T'
    if (type === 'richtext') return '¶'
    if (type === 'image')    return '🖼'
    if (type === 'layout')   return '▦'
    if (type === 'line')     return '╱'
    if (type === 'hline')    return '—'
    return '|'
  }
  const typeLabel = (el: DesignerPageElement) => {
    if (el.type === 'text')     return el.content || 'Label'
    if (el.type === 'richtext') {
      // Plain-text preview from the runs; same trimmed-to-fit treatment
      // the row uses for single-line text.
      const flat = el.runs.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim()
      return flat || 'Text block'
    }
    if (el.type === 'image')  return 'Image'
    if (el.type === 'layout') return 'Layout'
    if (el.type === 'line')   return 'Line'
    if (el.type === 'hline')  return 'H-Line'
    return 'V-Line'
  }

  return (
    <div className="mt-1 space-y-0.5">
      {elements.map((el) => (
        <button
          key={el.id}
          onClick={() => setSelectedElement(el.id)}
          className={`flex w-full items-center gap-2 rounded-card px-3 py-1.5 text-left text-sm transition-colors ${
            el.id === selectedElementId
              ? 'bg-cream font-medium text-green'
              : 'text-muted hover:bg-paper hover:text-navy'
          }`}
        >
          <span className="w-4 text-center text-xs font-bold leading-none">
            {typeIcon(el.type)}
          </span>
          <span className="truncate text-xs">{typeLabel(el)}</span>
        </button>
      ))}
    </div>
  )
}
