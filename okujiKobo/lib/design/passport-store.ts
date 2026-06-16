'use client'

import { create } from 'zustand'
import { debouncedUpdate } from './persist'
import type {
  DesignerPassport,
  DesignerPassportPage,
  DesignerStop,
  DesignerPunch,
  DesignerPageElement,
} from './types'

// Store-level auto-persist: every user-facing mutation also schedules a
// debounced write to the DB. This is what makes form edits, canvas drags,
// cover edits, and image-position drags all persist without the user
// needing to click Save — the explicit Save button is now just an
// instant-flush. saveAll() still exists as the manual flush + sweep that
// the Save button calls, and as the autosave backstop's last resort.

interface PassportStore {
  passport: DesignerPassport | null
  pages: DesignerPassportPage[]
  stops: DesignerStop[]
  // Punch slots — moichido (consumable) design-time objects. Parallel to
  // stops, but location-free (position + order + label only). Empty for
  // persistent passports, so the okuji designer is unaffected.
  punchSlots: DesignerPunch[]

  activePageId: string | null
  selectedStopId: string | null
  selectedPunchId: string | null
  selectedElementId: string | null

  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  // Last persist failure surfaced to the user via SaveIndicator.
  // Cleared on the next successful persist or by the Retry button.
  saveError: string | null

  // Row-level dirty tracking so saveAll() writes only what changed
  // instead of sweeping every row. Each mutator records the rows it
  // touched; markSaved clears. If isDirty is true but all three are
  // empty (a mutation that forgot to record itself), saveAll falls
  // back to the full sweep — same safety net useAutosave documents.
  dirtyPassport: boolean
  dirtyPageIds: Set<string>
  dirtyStopIds: Set<string>
  dirtyPunchIds: Set<string>

  hydrate: (
    passport: DesignerPassport,
    pages: DesignerPassportPage[],
    stops: DesignerStop[],
    punchSlots?: DesignerPunch[],
  ) => void

  setActivePage: (id: string) => void
  setSelectedStop: (id: string | null) => void
  setSelectedPunch: (id: string | null) => void
  setSelectedElement: (id: string | null) => void

  updatePassport: (patch: Partial<DesignerPassport>) => void
  updatePage: (id: string, patch: Partial<DesignerPassportPage>) => void
  addPage: (page: DesignerPassportPage) => void
  removePage: (id: string) => void
  reorderPages: (orderedIds: string[]) => void
  updateStop: (id: string, patch: Partial<DesignerStop>) => void
  addStop: (stop: DesignerStop) => void
  removeStop: (id: string) => void

  updatePunch: (id: string, patch: Partial<DesignerPunch>) => void
  addPunch: (punch: DesignerPunch) => void
  removePunch: (id: string) => void

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
  punchSlots: [],
  activePageId: null,
  selectedStopId: null,
  selectedPunchId: null,
  selectedElementId: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  saveError: null,
  dirtyPassport: false,
  dirtyPageIds: new Set<string>(),
  dirtyStopIds: new Set<string>(),
  dirtyPunchIds: new Set<string>(),

  hydrate: (passport, pages, stops, punchSlots = []) => {
    const sorted = [...pages]
      .sort((a, b) => a.page_order - b.page_order)
      .map((p) => ({ ...p, elements: p.elements ?? [] }))
    set({
      passport,
      pages: sorted,
      stops,
      punchSlots,
      activePageId: sorted[0]?.id ?? null,
      selectedStopId: null,
      selectedPunchId: null,
      selectedElementId: null,
      isDirty: false,
      dirtyPassport: false,
      dirtyPageIds: new Set<string>(),
      dirtyStopIds: new Set<string>(),
      dirtyPunchIds: new Set<string>(),
    })
  },

  setActivePage: (id) =>
    set({ activePageId: id, selectedStopId: null, selectedPunchId: null, selectedElementId: null }),
  setSelectedStop: (id) => set({ selectedStopId: id, selectedPunchId: null, selectedElementId: null }),
  setSelectedPunch: (id) => set({ selectedPunchId: id, selectedStopId: null, selectedElementId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id, selectedStopId: null, selectedPunchId: null }),

  updatePassport: (patch) => {
    set((s) => ({
      passport: s.passport ? { ...s.passport, ...patch } : null,
      isDirty: true,
      dirtyPassport: true,
    }))
    const id = get().passport?.id
    if (id) debouncedUpdate('passports', patch, 'id', id)
  },

  updatePage: (id, patch) => {
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      isDirty: true,
      dirtyPageIds: new Set(s.dirtyPageIds).add(id),
    }))
    debouncedUpdate('passport_pages', patch, 'id', id)
  },

  addPage: (page) =>
    set((s) => ({
      pages: [...s.pages, { ...page, elements: page.elements ?? [] }].sort(
        (a, b) => a.page_order - b.page_order,
      ),
      activePageId: page.id,
      isDirty: true,
      dirtyPageIds: new Set(s.dirtyPageIds).add(page.id),
    })),

  removePage: (id) =>
    set((s) => {
      const remaining = s.pages.filter((p) => p.id !== id)
      return {
        pages: remaining,
        activePageId:
          s.activePageId === id ? (remaining[0]?.id ?? null) : s.activePageId,
        stops: s.stops.filter((st) => st.page_id !== id),
        punchSlots: s.punchSlots.filter((p) => p.page_id !== id),
        selectedElementId: null,
        isDirty: true,
      }
    }),

  reorderPages: (orderedIds) => {
    const newPages = orderedIds.map((id, idx) => {
      const p = get().pages.find((pg) => pg.id === id)!
      return { ...p, page_order: idx }
    })
    set((s) => {
      // page_order changed on every page; mark them all so the saveAll
      // backstop sweeps the new order if the reorder endpoint's write
      // is what failed. (No Set spread — tsconfig target predates it.)
      const nextDirty = new Set(s.dirtyPageIds)
      orderedIds.forEach((id) => nextDirty.add(id))
      return { pages: newPages, isDirty: true, dirtyPageIds: nextDirty }
    })
    // Persistence is fired by the caller via the /api/passport_pages/
    // reorder endpoint — the per-row debouncedUpdate that lived here
    // hit the UNIQUE(passport_id, page_order) constraint on any swap
    // (each row's UPDATE collided with another row's current order
    // before the second UPDATE landed). The single-endpoint path
    // does a two-phase write that respects the immediate constraint.
  },

  updateStop: (id, patch) => {
    set((s) => ({
      stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch } : st)),
      isDirty: true,
      dirtyStopIds: new Set(s.dirtyStopIds).add(id),
    }))
    debouncedUpdate('stops', patch, 'id', id)
  },

  addStop: (stop) =>
    set((s) => ({
      stops: [...s.stops, stop],
      isDirty: true,
      dirtyStopIds: new Set(s.dirtyStopIds).add(stop.id),
    })),

  removeStop: (id) =>
    set((s) => ({
      stops: s.stops.filter((st) => st.id !== id),
      selectedStopId: s.selectedStopId === id ? null : s.selectedStopId,
      isDirty: true,
    })),

  updatePunch: (id, patch) => {
    set((s) => ({
      punchSlots: s.punchSlots.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      isDirty: true,
      dirtyPunchIds: new Set(s.dirtyPunchIds).add(id),
    }))
    debouncedUpdate('punch_slots', patch, 'id', id)
  },

  addPunch: (punch) =>
    set((s) => ({
      punchSlots: [...s.punchSlots, punch],
      isDirty: true,
      dirtyPunchIds: new Set(s.dirtyPunchIds).add(punch.id),
    })),

  removePunch: (id) =>
    set((s) => ({
      punchSlots: s.punchSlots.filter((p) => p.id !== id),
      selectedPunchId: s.selectedPunchId === id ? null : s.selectedPunchId,
      isDirty: true,
    })),

  addElement: (pageId, element) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return { ...p, elements: [...(p.elements ?? []), element] }
    })
    set((s) => ({ pages, isDirty: true, dirtyPageIds: new Set(s.dirtyPageIds).add(pageId) }))
    const elements = pages.find((p) => p.id === pageId)!.elements
    debouncedUpdate('passport_pages', { elements }, 'id', pageId)
    return elements
  },

  updateElement: (pageId, elementId, patch) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return {
        ...p,
        elements: (p.elements ?? []).map((el) =>
          // Spreading el+patch widens the discriminated `type`; cast back.
          el.id === elementId ? ({ ...el, ...patch } as DesignerPageElement) : el,
        ),
      }
    })
    set((s) => ({ pages, isDirty: true, dirtyPageIds: new Set(s.dirtyPageIds).add(pageId) }))
    const elements = pages.find((p) => p.id === pageId)!.elements
    debouncedUpdate('passport_pages', { elements }, 'id', pageId)
    return elements
  },

  removeElement: (pageId, elementId) => {
    const pages = get().pages.map((p) => {
      if (p.id !== pageId) return p
      return {
        ...p,
        elements: (p.elements ?? []).filter((el) => el.id !== elementId),
      }
    })
    set((s) => ({ pages, isDirty: true, dirtyPageIds: new Set(s.dirtyPageIds).add(pageId) }))
    const elements = pages.find((p) => p.id === pageId)!.elements
    debouncedUpdate('passport_pages', { elements }, 'id', pageId)
    return elements
  },

  markDirty: () => set({ isDirty: true }),
  markSaved: () =>
    set({
      isDirty: false,
      isSaving: false,
      lastSavedAt: new Date(),
      saveError: null,
      dirtyPassport: false,
      dirtyPageIds: new Set<string>(),
      dirtyStopIds: new Set<string>(),
      dirtyPunchIds: new Set<string>(),
    }),
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

export const selectActivePagePunches = (s: PassportStore) =>
  s.punchSlots.filter((p) => p.page_id === s.activePageId)

export const selectSelectedPunch = (s: PassportStore) =>
  s.punchSlots.find((p) => p.id === s.selectedPunchId) ?? null

// Returns the page the currently-selected stop belongs to (not the page
// currently shown in the workspace). Used by RightInspector so the stop
// panel keeps rendering its controls even when the active tab is an
// information page — selecting a stop on a stamp page from elsewhere in
// the UI shouldn't be hidden by which tab the user happens to be on.
export const selectSelectedStopPage = (s: PassportStore) => {
  const stop = s.stops.find((st) => st.id === s.selectedStopId)
  if (!stop) return null
  return s.pages.find((p) => p.id === stop.page_id) ?? null
}

export const selectSelectedElement = (s: PassportStore) => {
  if (!s.selectedElementId) return null
  const page = s.pages.find((p) => p.id === s.activePageId)
  return page?.elements?.find((el) => el.id === s.selectedElementId) ?? null
}
