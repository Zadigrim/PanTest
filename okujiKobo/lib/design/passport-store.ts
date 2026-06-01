'use client'

import { create } from 'zustand'
import type {
  DesignerPassport,
  DesignerPassportPage,
  DesignerStop,
  DesignerPageElement,
} from './types'

interface PassportStore {
  passport: DesignerPassport | null
  pages: DesignerPassportPage[]
  stops: DesignerStop[]

  activePageId: string | null
  selectedStopId: string | null
  selectedElementId: string | null

  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  // Last persist failure surfaced to the user via SaveIndicator.
  // Cleared on the next successful persist or by the Retry button.
  saveError: string | null

  hydrate: (
    passport: DesignerPassport,
    pages: DesignerPassportPage[],
    stops: DesignerStop[],
  ) => void

  setActivePage: (id: string) => void
  setSelectedStop: (id: string | null) => void
  setSelectedElement: (id: string | null) => void

  updatePassport: (patch: Partial<DesignerPassport>) => void
  updatePage: (id: string, patch: Partial<DesignerPassportPage>) => void
  addPage: (page: DesignerPassportPage) => void
  removePage: (id: string) => void
  reorderPages: (orderedIds: string[]) => void
  updateStop: (id: string, patch: Partial<DesignerStop>) => void
  addStop: (stop: DesignerStop) => void
  removeStop: (id: string) => void

  // Page elements (stored as JSON on the page row)
  addElement: (pageId: string, element: DesignerPageElement) => DesignerPageElement[]
  updateElement: (
    pageId: string,
    elementId: string,
    patch: Partial<DesignerPageElement>,
  ) => DesignerPageElement[]
  removeElement: (pageId: string, elementId: string) => DesignerPageElement[]

  markDirty: () => void
  markSaved: () => void
  setSaving: (v: boolean) => void
  setSaveError: (msg: string | null) => void
}

export const usePassportStore = create<PassportStore>((set, get) => ({
  passport: null,
  pages: [],
  stops: [],
  activePageId: null,
  selectedStopId: null,
  selectedElementId: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  saveError: null,

  hydrate: (passport, pages, stops) => {
    const sorted = [...pages]
      .sort((a, b) => a.page_order - b.page_order)
      .map((p) => ({ ...p, elements: p.elements ?? [] }))
    set({
      passport,
      pages: sorted,
      stops,
      activePageId: sorted[0]?.id ?? null,
      selectedStopId: null,
      selectedElementId: null,
      isDirty: false,
    })
  },

  setActivePage: (id) =>
    set({ activePageId: id, selectedStopId: null, selectedElementId: null }),
  setSelectedStop: (id) => set({ selectedStopId: id, selectedElementId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id, selectedStopId: null }),

  updatePassport: (patch) =>
    set((s) => ({
      passport: s.passport ? { ...s.passport, ...patch } : null,
      isDirty: true,
    })),

  updatePage: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      isDirty: true,
    })),

  addPage: (page) =>
    set((s) => ({
      pages: [...s.pages, { ...page, elements: page.elements ?? [] }].sort(
        (a, b) => a.page_order - b.page_order,
      ),
      activePageId: page.id,
      isDirty: true,
    })),

  removePage: (id) =>
    set((s) => {
      const remaining = s.pages.filter((p) => p.id !== id)
      return {
        pages: remaining,
        activePageId:
          s.activePageId === id ? (remaining[0]?.id ?? null) : s.activePageId,
        stops: s.stops.filter((st) => st.page_id !== id),
        selectedElementId: null,
        isDirty: true,
      }
    }),

  reorderPages: (orderedIds) =>
    set((s) => ({
      pages: orderedIds.map((id, idx) => {
        const p = s.pages.find((pg) => pg.id === id)!
        return { ...p, page_order: idx }
      }),
      isDirty: true,
    })),

  updateStop: (id, patch) =>
    set((s) => ({
      stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch } : st)),
      isDirty: true,
    })),

  addStop: (stop) => set((s) => ({ stops: [...s.stops, stop], isDirty: true })),

  removeStop: (id) =>
    set((s) => ({
      stops: s.stops.filter((st) => st.id !== id),
      selectedStopId: s.selectedStopId === id ? null : s.selectedStopId,
      isDirty: true,
    })),

  addElement: (pageId, element) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return { ...p, elements: [...(p.elements ?? []), element] }
    })
    set({ pages, isDirty: true })
    return pages.find((p) => p.id === pageId)!.elements
  },

  updateElement: (pageId, elementId, patch) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return {
        ...p,
        elements: (p.elements ?? []).map((el) =>
          el.id === elementId ? { ...el, ...patch } : el,
        ),
      }
    })
    set({ pages, isDirty: true })
    return pages.find((p) => p.id === pageId)!.elements
  },

  removeElement: (pageId, elementId) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return {
        ...p,
        elements: (p.elements ?? []).filter((el) => el.id !== elementId),
      }
    })
    set({ pages, isDirty: true })
    return pages.find((p) => p.id === pageId)!.elements
  },

  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: new Date(), saveError: null }),
  setSaving: (v) => set({ isSaving: v }),
  setSaveError: (msg) => set({ saveError: msg, isSaving: false }),
}))

// ── Selectors ──────────────────────────────────────────────────────────────────

export const selectActivePageStops = (s: PassportStore) =>
  s.stops.filter((st) => st.page_id === s.activePageId)

export const selectActivePage = (s: PassportStore) =>
  s.pages.find((p) => p.id === s.activePageId) ?? null

export const selectSelectedStop = (s: PassportStore) =>
  s.stops.find((st) => st.id === s.selectedStopId) ?? null

export const selectSelectedElement = (s: PassportStore) => {
  if (!s.selectedElementId) return null
  const page = s.pages.find((p) => p.id === s.activePageId)
  return page?.elements?.find((el) => el.id === s.selectedElementId) ?? null
}
