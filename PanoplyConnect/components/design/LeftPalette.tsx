'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
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
      <div className="w-96 rounded-panel border border-panoply-gray-2 bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-panoply-navy">What kind of page is this?</h2>
        <p className="mb-5 text-xs text-panoply-gray-3">Choose a page type to continue.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('stamp')}
            className="flex flex-col items-start gap-1.5 rounded-panel border-2 border-panoply-gray-2 p-4 text-left transition-colors hover:border-panoply-teal hover:bg-panoply-teal-lt"
          >
            <span className="text-2xl">📮</span>
            <span className="text-sm font-semibold text-panoply-navy">Stamp page</span>
            <span className="text-xs text-panoply-gray-3 leading-relaxed">
              Has location boxes for collecting stamps
            </span>
          </button>
          <button
            onClick={() => onSelect('information')}
            className="flex flex-col items-start gap-1.5 rounded-panel border-2 border-panoply-gray-2 p-4 text-left transition-colors hover:border-panoply-teal hover:bg-panoply-teal-lt"
          >
            <span className="text-2xl">📄</span>
            <span className="text-sm font-semibold text-panoply-navy">Information page</span>
            <span className="text-xs text-panoply-gray-3 leading-relaxed">
              Text, images, and decorative elements only
            </span>
          </button>
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full text-xs text-panoply-gray-3 hover:text-panoply-navy transition-colors"
        >
          Cancel
        </button>
      </div>
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
  const addStop = usePassportStore((s) => s.addStop)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const addElement = usePassportStore((s) => s.addElement)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)

  const [addingStop, setAddingStop] = useState(false)
  const [addingPage, setAddingPage] = useState(false)
  const [showPageTypePicker, setShowPageTypePicker] = useState(false)

  const activePage = pages.find((p) => p.id === activePageId)
  const isInfoPage = activePage?.page_type === 'information'

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

    const defaults: DesignerPageElement =
      type === 'text'
        ? {
            id,
            type,
            x: 40,
            y: 40,
            width: 200,
            height: 28,
            content: 'Section Header',
            fontSize: 16,
            fontWeight: 'bold',
            color: '0D1B2A',
            align: 'left',
          }
        : type === 'hline'
        ? { id, type, x: 40, y: 100, width: 532, height: 8, thickness: 2, lineColor: '0D1B2A' }
        : { id, type, x: 300, y: 40, width: 8, height: 400, thickness: 2, lineColor: '0D1B2A' }

    const updated = addElement(activePageId, defaults)
    setSelectedElement(id)
    const db = createClient() as any
    await db.from('passport_pages').update({ elements: updated }).eq('id', activePageId)
  }

  const handleAddPage = () => {
    if (!passport) return
    setShowPageTypePicker(true)
  }

  const handlePageTypeSelected = async (pageType: PageType) => {
    setShowPageTypePicker(false)
    if (!passport) return
    setAddingPage(true)
    const db = createClient() as any
    const nextOrder = pages.length
    const { data, error } = await db
      .from('passport_pages')
      .insert({
        passport_id: passport.id,
        page_order: nextOrder,
        page_type: pageType,
        section_name: `Section ${nextOrder + 1}`,
        background_type: 'guilloche',
        background_color: '0D1B2A',
        background_opacity: 12,
        paper_color: 'F5F2EC',
      })
      .select()
      .single()

    setAddingPage(false)
    if (!error && data) {
      addPage(data as DesignerPassportPage)
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

      <aside className="flex w-60 shrink-0 flex-col border-r border-panoply-gray-2 bg-white">
        {/* Passport meta */}
        <div className="border-b border-panoply-gray-2 px-4 py-3">
          <p className="truncate text-xs font-semibold text-panoply-navy">
            {passport?.title ?? 'Loading…'}
          </p>
          <p className="mt-0.5 text-xs text-panoply-gray-3 capitalize">
            {passport?.status ?? 'draft'}
          </p>
        </div>

        {/* Pages list */}
        <div className="border-b border-panoply-gray-2 px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
            Pages
          </p>
          <div className="space-y-0.5">
            {pages.map((page, i) => (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`flex w-full items-center gap-1.5 rounded-card px-3 py-1.5 text-left text-sm transition-colors ${
                  page.id === activePageId
                    ? 'bg-panoply-teal-lt font-medium text-panoply-teal-dk'
                    : 'text-panoply-gray-3 hover:bg-panoply-gray-1 hover:text-panoply-navy'
                }`}
              >
                <span className="text-xs" aria-hidden="true">
                  {page.page_type === 'information' ? '📄' : '📮'}
                </span>
                <span className="truncate">
                  {page.section_title ?? page.section_name ?? `Page ${i + 1}`}
                </span>
              </button>
            ))}
          </div>
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

        {/* Stops — only on stamp pages */}
        {!isInfoPage && (
          <div className="border-b border-panoply-gray-2 px-3 py-2">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
              Stops
            </p>
            <StopsList />
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 w-full text-xs"
              onClick={handleAddStop}
              disabled={addingStop || !activePageId}
            >
              {addingStop ? 'Adding…' : '+ Add stop'}
            </Button>
          </div>
        )}

        {/* Page elements */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
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
              onClick={() => handleAddElement('hline')}
              disabled={!activePageId}
            >
              <span>—</span> Add H-line
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-2"
              onClick={() => handleAddElement('vline')}
              disabled={!activePageId}
            >
              <span>|</span> Add V-line
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
      <p className="py-3 text-center text-xs text-panoply-gray-3">No stops yet</p>
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
              ? 'bg-panoply-teal-lt font-medium text-panoply-teal-dk'
              : 'text-panoply-gray-3 hover:bg-panoply-gray-1 hover:text-panoply-navy'
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

  const typeIcon = (type: string) =>
    type === 'text' ? 'T' : type === 'hline' ? '—' : '|'
  const typeLabel = (el: DesignerPageElement) =>
    el.type === 'text' ? el.content || 'Label' : el.type === 'hline' ? 'H-Line' : 'V-Line'

  return (
    <div className="mt-1 space-y-0.5">
      {elements.map((el) => (
        <button
          key={el.id}
          onClick={() => setSelectedElement(el.id)}
          className={`flex w-full items-center gap-2 rounded-card px-3 py-1.5 text-left text-sm transition-colors ${
            el.id === selectedElementId
              ? 'bg-panoply-teal-lt font-medium text-panoply-teal-dk'
              : 'text-panoply-gray-3 hover:bg-panoply-gray-1 hover:text-panoply-navy'
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
