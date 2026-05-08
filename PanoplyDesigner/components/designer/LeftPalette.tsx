'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/stores/passport-store'
import { Button } from '@/components/ui/button'
import type { Stop, PassportPage, PageElement, PageElementType } from '@/lib/supabase/types'

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
  const [elemSaveError, setElemSaveError] = useState<string | null>(null)

  const handleAddStop = async () => {
    if (!activePageId || !passport) return
    setAddingStop(true)
    const supabase = createClient()
    const existingCount = usePassportStore.getState().stops.filter(
      (s) => s.page_id === activePageId,
    ).length
    const { data, error } = await supabase
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
      } as Partial<Stop>)
      .select()
      .single()

    setAddingStop(false)
    if (!error && data) {
      addStop(data as Stop)
      setSelectedStop(data.id)
    }
  }

  const handleAddElement = async (type: PageElementType) => {
    if (!activePageId) return
    const crypto = typeof window !== 'undefined' ? window.crypto : null
    const id = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
    const defaults: PageElement =
      type === 'text'
        ? { id, type, x: 40, y: 40, width: 200, height: 28, content: 'Section Header', fontSize: 16, fontWeight: 'bold', color: '0D1B2A', align: 'left' }
        : type === 'hline'
        ? { id, type, x: 40, y: 100, width: 532, height: 8, thickness: 2, lineColor: '0D1B2A' }
        : { id, type, x: 300, y: 40, width: 8, height: 400, thickness: 2, lineColor: '0D1B2A' }

    const updated = addElement(activePageId, defaults)
    setSelectedElement(id)
    const supabase = createClient()
    const { error } = await supabase.from('passport_pages').update({ elements: updated }).eq('id', activePageId)
    if (error) {
      console.error('[designer] elements save failed — is migration 017 applied?', error)
      setElemSaveError('Could not save element. Check the browser console for details.')
    } else {
      setElemSaveError(null)
    }
  }

  const handleAddPage = async () => {
    if (!passport) return
    setAddingPage(true)
    const supabase = createClient()
    const nextOrder = pages.length
    const { data, error } = await supabase
      .from('passport_pages')
      .insert({
        passport_id: passport.id,
        page_order: nextOrder,
        section_name: `Section ${nextOrder + 1}`,
        background_type: 'guilloche',
        background_color: '0D1B2A',
        background_opacity: 12,
        paper_color: 'F5F2EC',
      } as Partial<PassportPage>)
      .select()
      .single()

    setAddingPage(false)
    if (!error && data) {
      addPage(data as PassportPage)
    }
  }

  return (
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
              className={`w-full rounded-card px-3 py-1.5 text-left text-sm transition-colors ${
                page.id === activePageId
                  ? 'bg-panoply-teal-lt font-medium text-panoply-teal-dk'
                  : 'text-panoply-gray-3 hover:bg-panoply-gray-1 hover:text-panoply-navy'
              }`}
            >
              {page.section_title ?? page.section_name ?? `Page ${i + 1}`}
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

      {/* Stops on active page */}
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

      {/* Page elements */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
          Elements
        </p>
        {elemSaveError && (
          <p className="mb-2 rounded-card bg-red-50 px-2 py-1.5 text-xs text-red-600">
            {elemSaveError}
          </p>
        )}
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => handleAddElement('text')} disabled={!activePageId}>
            <span>T</span> Add label
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => handleAddElement('hline')} disabled={!activePageId}>
            <span>—</span> Add H-line
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => handleAddElement('vline')} disabled={!activePageId}>
            <span>|</span> Add V-line
          </Button>
        </div>
        <ElementsList pageId={activePageId} />
      </div>
    </aside>
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
      <p className="py-3 text-center text-xs text-panoply-gray-3">
        No stops yet
      </p>
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
          {stop.stamp_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stop.stamp_image_url} alt="" className="h-5 w-5 object-contain shrink-0 rounded-sm" />
          ) : (
            <span className="text-base leading-none">{stop.stamp_icon ?? '📍'}</span>
          )}
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
  const typeLabel = (el: PageElement) =>
    el.type === 'text' ? (el.content || 'Label') : el.type === 'hline' ? 'H-Line' : 'V-Line'

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
          <span className="w-4 text-center text-xs font-bold leading-none">{typeIcon(el.type)}</span>
          <span className="truncate text-xs">{typeLabel(el)}</span>
        </button>
      ))}
    </div>
  )
}
