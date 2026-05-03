'use client'

import { create } from 'zustand'
import type { Passport, PassportPage, Stop } from '@/lib/supabase/types'

interface PassportStore {
  // Server-fetched data
  passport: Passport | null
  pages: PassportPage[]
  stops: Stop[]

  // UI selection state
  activePageId: string | null
  selectedStopId: string | null

  // Dirty / save state
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  // Hydrate from server fetch
  hydrate: (passport: Passport, pages: PassportPage[], stops: Stop[]) => void

  // Selection
  setActivePage: (id: string) => void
  setSelectedStop: (id: string | null) => void

  // Optimistic updates (caller is responsible for Supabase sync)
  updatePassport: (patch: Partial<Passport>) => void
  updatePage: (id: string, patch: Partial<PassportPage>) => void
  addPage: (page: PassportPage) => void
  removePage: (id: string) => void
  updateStop: (id: string, patch: Partial<Stop>) => void
  addStop: (stop: Stop) => void
  removeStop: (id: string) => void

  // Save state helpers
  markDirty: () => void
  markSaved: () => void
  setSaving: (v: boolean) => void
}

export const usePassportStore = create<PassportStore>((set, get) => ({
  passport: null,
  pages: [],
  stops: [],
  activePageId: null,
  selectedStopId: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  hydrate: (passport, pages, stops) => {
    const sorted = [...pages].sort((a, b) => a.page_order - b.page_order)
    set({
      passport,
      pages: sorted,
      stops,
      activePageId: sorted[0]?.id ?? null,
      selectedStopId: null,
      isDirty: false,
    })
  },

  setActivePage: (id) => set({ activePageId: id, selectedStopId: null }),
  setSelectedStop: (id) => set({ selectedStopId: id }),

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
      pages: [...s.pages, page].sort((a, b) => a.page_order - b.page_order),
      activePageId: page.id,
      isDirty: true,
    })),

  removePage: (id) =>
    set((s) => {
      const remaining = s.pages.filter((p) => p.id !== id)
      const newActive =
        s.activePageId === id
          ? (remaining[0]?.id ?? null)
          : s.activePageId
      return {
        pages: remaining,
        activePageId: newActive,
        stops: s.stops.filter((st) => st.page_id !== id),
        isDirty: true,
      }
    }),

  updateStop: (id, patch) =>
    set((s) => ({
      stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch } : st)),
      isDirty: true,
    })),

  addStop: (stop) =>
    set((s) => ({ stops: [...s.stops, stop], isDirty: true })),

  removeStop: (id) =>
    set((s) => ({
      stops: s.stops.filter((st) => st.id !== id),
      selectedStopId: s.selectedStopId === id ? null : s.selectedStopId,
      isDirty: true,
    })),

  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: new Date() }),
  setSaving: (v) => set({ isSaving: v }),
}))

// Selector helpers
export const selectActivePageStops = (s: PassportStore) =>
  s.stops.filter((st) => st.page_id === s.activePageId)

export const selectActivePage = (s: PassportStore) =>
  s.pages.find((p) => p.id === s.activePageId) ?? null

export const selectSelectedStop = (s: PassportStore) =>
  s.stops.find((st) => st.id === s.selectedStopId) ?? null
