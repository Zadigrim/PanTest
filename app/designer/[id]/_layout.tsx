// Designer workspace shell — 3-column layout (left rail · canvas · inspector).
// Provides DesignerContext consumed by all child routes.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  useWindowDimensions, ActivityIndicator,
} from 'react-native'
import { Slot, router, useLocalSearchParams, usePathname } from 'expo-router'
import { supabase, getCurrentUser } from '../../../lib/supabase'
import type { Passport, PassportPage } from '../../../types'
import { palette } from '../../../lib/colors'

// ── Designer context ──────────────────────────────────────────────────────────
export type SelectedType = 'slot' | 'stop' | 'section' | null
export type ActiveTool   = 'slot' | 'pin' | 'text' | 'image' | null

interface DesignerCtx {
  passport: Passport | null
  pages: PassportPage[]
  selectedId: string | null
  selectedType: SelectedType
  activeTool: ActiveTool
  saving: boolean
  setSelection: (id: string | null, type: SelectedType) => void
  setActiveTool: (t: ActiveTool) => void
  refresh: () => void
  save: (patch: Partial<Passport>) => Promise<void>
}

const Ctx = createContext<DesignerCtx>({
  passport: null, pages: [], selectedId: null, selectedType: null,
  activeTool: null, saving: false,
  setSelection: () => {}, setActiveTool: () => {}, refresh: () => {},
  save: async () => {},
})
export function useDesigner() { return useContext(Ctx) }

const INK     = palette.ink
const PAPER   = palette.paper
const MUTED   = palette.muted
const HAIRLINE = palette.hairline
const ACCENT  = palette.accent
const GREEN   = palette.green
const NAVY    = palette.navy

const RAIL_W     = 172
const INSPECT_W  = 256
const WIDE_3     = 880   // show all 3 columns
const WIDE_2     = 560   // show rail + canvas (no inspector)

const WORKSHOP = [
  { key: 'cover',   label: 'Cover',   path: 'cover' },
  { key: 'pages',   label: 'Pages',   path: 'pages' },
  { key: 'stops',   label: 'Stops',   path: 'stops' },
  { key: 'theme',   label: 'Theme',   path: 'theme' },
  { key: 'pricing', label: 'Pricing', path: 'pricing' },
  { key: 'publish', label: 'Publish', path: 'publish' },
] as const

export default function DesignerLayout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const pathname = usePathname()

  const [passport, setPassport] = useState<Passport | null>(null)
  const [pages, setPages] = useState<PassportPage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<SelectedType>(null)
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)

  const load = useCallback(async () => {
    const [{ data: p }, { data: pg }] = await Promise.all([
      supabase.from('passports').select('*').eq('id', id).single(),
      supabase.from('passport_pages').select('*').eq('passport_id', id).order('page_order'),
    ])
    setPassport(p)
    setPages(pg ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { router.replace('/(auth)/login'); return }
      load()
    })
  }, [load])

  const save = useCallback(async (patch: Partial<Passport>) => {
    if (!id) return
    setSaving(true)
    await supabase.from('passports').update(patch).eq('id', id)
    setPassport(p => p ? { ...p, ...patch } : p)
    setSaving(false)
  }, [id])

  const addSection = useCallback(async () => {
    const { data } = await supabase
      .from('passport_pages')
      .insert({ passport_id: id, page_order: pages.length + 1, section_name: `Section ${pages.length + 1}` })
      .select().single()
    if (data) setPages(p => [...p, data])
  }, [id, pages.length])

  // Derive active workshop tab from pathname
  const activeWorkshop = WORKSHOP.find(w => pathname.includes(`/${w.path}`))?.key ?? 'pages'

  const showRail     = width >= WIDE_2
  const showInspect  = width >= WIDE_3

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  return (
    <Ctx.Provider value={{
      passport, pages, selectedId, selectedType, activeTool, saving,
      setSelection: (id, type) => { setSelectedId(id); setSelectedType(type) },
      setActiveTool,
      refresh: load,
      save,
    }}>
      <View style={s.root}>

        {/* ── Left rail ──────────────────────────────────────────────── */}
        {showRail && (
          <View style={s.rail}>
            {/* Back to list */}
            <TouchableOpacity style={s.backRow} onPress={() => router.push('/designer' as any)}>
              <Text style={s.backLabel}>‹ Passports</Text>
            </TouchableOpacity>

            {/* Passport name + status chip */}
            <View style={s.passportNameRow}>
              <Text style={s.passportName} numberOfLines={2}>{passport?.title ?? '…'}</Text>
              <View style={[s.chip, passport?.is_published ? s.chipPublished : s.chipDraft]}>
                <Text style={[s.chipText, passport?.is_published ? s.chipTextPublished : s.chipTextDraft]}>
                  {passport?.is_published ? 'Published' : 'Draft'}
                </Text>
              </View>
            </View>

            {/* Workshop sections nav */}
            <View style={s.workshopList}>
              {WORKSHOP.map(({ key, label, path }) => (
                <TouchableOpacity
                  key={key}
                  style={[s.workshopItem, activeWorkshop === key && s.workshopItemActive]}
                  onPress={() => router.push(`/designer/${id}/${path}` as any)}
                >
                  <Text style={[s.workshopLabel, activeWorkshop === key && s.workshopLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.divider} />

            {/* Sections (pages) list */}
            <ScrollView style={s.sectionScroll} showsVerticalScrollIndicator={false}>
              {pages.map((page, i) => (
                <TouchableOpacity
                  key={page.id}
                  style={[
                    s.sectionRow,
                    selectedId === page.id && selectedType === 'section' && s.sectionRowActive,
                  ]}
                  onPress={() => {
                    setSelectedId(page.id)
                    setSelectedType('section')
                    router.push(`/designer/${id}/pages` as any)
                  }}
                >
                  <Text style={s.sectionNum}>{['I','II','III','IV','V','VI','VII','VIII'][i] ?? `${i+1}`}.</Text>
                  <Text style={s.sectionLabel} numberOfLines={1}>{page.section_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={s.addSection} onPress={addSection}>
              <Text style={s.addSectionText}>+ section</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Center canvas ──────────────────────────────────────────── */}
        <View style={s.canvas}>
          {/* Toolbar */}
          <CanvasToolbar
            activeWorkshop={activeWorkshop}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            saving={saving}
            onSave={() => save({ updated_at: new Date().toISOString() })}
            onPreview={() => router.push(`/passport/${id}` as any)}
          />
          {/* Current route */}
          <View style={s.canvasBody}>
            <Slot />
          </View>
        </View>

        {/* ── Right inspector ────────────────────────────────────────── */}
        {showInspect && (
          <InspectorPanel
            selectedId={selectedId}
            selectedType={selectedType}
            pages={pages}
            passportId={id}
            onRefresh={load}
          />
        )}

      </View>
    </Ctx.Provider>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────────
function CanvasToolbar({
  activeWorkshop, activeTool, setActiveTool, saving, onSave, onPreview,
}: {
  activeWorkshop: string
  activeTool: ActiveTool
  setActiveTool: (t: ActiveTool) => void
  saving: boolean
  onSave: () => void
  onPreview: () => void
}) {
  const tools: { key: ActiveTool; label: string }[] = [
    { key: 'slot',  label: '▢ slot' },
    { key: 'pin',   label: '⌖ pin' },
    { key: 'text',  label: 'T text' },
    { key: 'image', label: '📷 image' },
  ]

  return (
    <View style={tb.bar}>
      <View style={tb.left}>
        {activeWorkshop === 'pages' && tools.map(({ key, label }) => (
          <TouchableOpacity
            key={key ?? 'none'}
            style={[tb.toolBtn, activeTool === key && tb.toolBtnActive]}
            onPress={() => setActiveTool(activeTool === key ? null : key)}
          >
            <Text style={[tb.toolLabel, activeTool === key && tb.toolLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={tb.right}>
        <TouchableOpacity style={tb.actionBtn} onPress={onPreview}>
          <Text style={tb.actionLabel}>preview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tb.actionBtn, tb.saveBtn, saving && tb.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={tb.saveBtnLabel}>{saving ? '…' : 'save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Right Inspector Panel ──────────────────────────────────────────────────────
function InspectorPanel({
  selectedId, selectedType, pages, passportId, onRefresh,
}: {
  selectedId: string | null
  selectedType: SelectedType
  pages: PassportPage[]
  passportId: string
  onRefresh: () => void
}) {
  const page = selectedType === 'section'
    ? pages.find(p => p.id === selectedId) ?? null
    : null

  return (
    <View style={ins.panel}>
      <Text style={ins.heading}>Inspector</Text>

      {!selectedId && (
        <Text style={ins.empty}>Select an element on the canvas to inspect it.</Text>
      )}

      {selectedType === 'section' && page && (
        <SectionInspector page={page} passportId={passportId} onRefresh={onRefresh} />
      )}

      {selectedType === 'stop' && selectedId && (
        <StopInspector stopId={selectedId} passportId={passportId} onRefresh={onRefresh} />
      )}

      {selectedType === 'slot' && selectedId && (
        <Text style={ins.empty}>Stamp slot selected. Drag to reposition; use handles to resize.</Text>
      )}
    </View>
  )
}

function SectionInspector({
  page, passportId, onRefresh,
}: { page: PassportPage; passportId: string; onRefresh: () => void }) {
  const [name, setName] = useState(page.section_name)
  const [tagline, setTagline] = useState(page.section_tagline ?? '')
  const [prize, setPrize] = useState(page.prize_description ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('passport_pages').update({
      section_name: name, section_tagline: tagline || null, prize_description: prize || null,
    }).eq('id', page.id)
    setSaving(false)
    onRefresh()
  }

  const del = async () => {
    await supabase.from('passport_pages').delete().eq('id', page.id)
    onRefresh()
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <InspField label="Section name">
        <InspInput value={name} onChangeText={setName} />
      </InspField>
      <InspField label="Tagline">
        <InspInput value={tagline} onChangeText={setTagline} placeholder="optional" />
      </InspField>
      <InspField label="Prize">
        <InspInput value={prize} onChangeText={setPrize} placeholder="optional" multiline />
      </InspField>
      <TouchableOpacity
        style={[ins.saveBtn, saving && ins.saveBtnDisabled]}
        onPress={save} disabled={saving}
      >
        <Text style={ins.saveBtnText}>{saving ? 'Saving…' : 'Save section'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={ins.deleteBtn} onPress={del}>
        <Text style={ins.deleteBtnText}>Delete section</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function StopInspector({
  stopId, passportId, onRefresh,
}: { stopId: string; passportId: string; onRefresh: () => void }) {
  const [stop, setStop] = useState<any>(null)
  useEffect(() => {
    supabase.from('stops').select('*').eq('id', stopId).single().then(({ data }) => setStop(data))
  }, [stopId])

  if (!stop) return <ActivityIndicator color={ACCENT} style={{ marginTop: 16 }} />

  return (
    <ScrollView style={{ flex: 1 }}>
      <InspField label="Stop name">
        <Text style={ins.readonlyValue}>{stop.name}</Text>
      </InspField>
      {!!stop.location_name && (
        <InspField label="Location">
          <Text style={ins.readonlyValue}>{stop.location_name}</Text>
        </InspField>
      )}
      <InspField label="Radius">
        <Text style={ins.readonlyValue}>{stop.radius_meters}m</Text>
      </InspField>
      <InspField label="Verify mode">
        <Text style={ins.readonlyValue}>{stop.verify_mode ?? 'gps'}</Text>
      </InspField>
      <TouchableOpacity
        style={ins.editBtn}
        onPress={() => router.push(`/designer/stop/${stopId}` as any)}
      >
        <Text style={ins.editBtnText}>Edit stop →</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

// ── Small inspector primitives ────────────────────────────────────────────────
import { TextInput } from 'react-native'

function InspField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={ins.field}>
      <Text style={ins.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function InspInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={ins.fieldInput}
      placeholderTextColor={HAIRLINE}
      {...props}
    />
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f0ece3' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Left rail
  rail: {
    width: RAIL_W,
    backgroundColor: PAPER,
    borderRightWidth: 1, borderRightColor: HAIRLINE,
  },
  backRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE,
  },
  backLabel: { fontSize: 12, color: MUTED },
  passportNameRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  passportName: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  chip: {
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1,
  },
  chipDraft: { borderColor: HAIRLINE, backgroundColor: 'transparent' },
  chipPublished: { borderColor: GREEN, backgroundColor: 'rgba(29,158,117,0.08)' },
  chipText: { fontSize: 10, fontWeight: '600' },
  chipTextDraft: { color: MUTED },
  chipTextPublished: { color: GREEN },

  workshopList: { paddingHorizontal: 8, paddingTop: 6 },
  workshopItem: {
    paddingVertical: 7, paddingHorizontal: 8,
    borderLeftWidth: 2, borderLeftColor: 'transparent', borderRadius: 2,
  },
  workshopItemActive: { borderLeftColor: ACCENT, backgroundColor: 'rgba(201,168,76,0.07)' },
  workshopLabel: { fontSize: 13, color: MUTED },
  workshopLabelActive: { color: INK, fontWeight: '600' },

  divider: { height: 1, backgroundColor: HAIRLINE, marginHorizontal: 10, marginVertical: 8 },

  sectionScroll: { flex: 1, paddingHorizontal: 8 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 6,
    borderRadius: 4, borderWidth: 1, borderColor: 'transparent',
    marginBottom: 2,
  },
  sectionRowActive: { backgroundColor: PAPER, borderColor: INK },
  sectionNum: { fontSize: 10, color: MUTED, width: 18 },
  sectionLabel: { fontSize: 12, color: INK, flex: 1 },

  addSection: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE },
  addSectionText: { fontSize: 12, color: MUTED },

  // Canvas
  canvas: { flex: 1, flexDirection: 'column' },
  canvasBody: { flex: 1 },
})

const tb = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: PAPER,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
    height: 40,
  },
  left: { flexDirection: 'row', gap: 4 },
  right: { flexDirection: 'row', gap: 6 },
  toolBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  toolBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(201,168,76,0.1)' },
  toolLabel: { fontSize: 11, color: MUTED },
  toolLabelActive: { color: INK, fontWeight: '600' },
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    borderWidth: 1, borderColor: HAIRLINE,
  },
  actionLabel: { fontSize: 11, color: MUTED },
  saveBtn: { backgroundColor: GREEN, borderColor: GREEN },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnLabel: { fontSize: 11, color: '#fff', fontWeight: '600' },
})

const ins = StyleSheet.create({
  panel: {
    width: INSPECT_W,
    backgroundColor: PAPER,
    borderLeftWidth: 1, borderLeftColor: HAIRLINE,
    padding: 14,
  },
  heading: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, color: MUTED,
    textTransform: 'uppercase', marginBottom: 12,
  },
  empty: { fontSize: 12, color: HAIRLINE, fontStyle: 'italic', lineHeight: 18 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 10, color: MUTED, marginBottom: 4, letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 3,
    padding: 7, fontSize: 13, color: INK, backgroundColor: '#fff',
  },
  readonlyValue: { fontSize: 13, color: INK },
  saveBtn: {
    backgroundColor: GREEN, borderRadius: 4, padding: 10, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  deleteBtnText: { color: '#c0392b', fontSize: 12 },
  editBtn: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4,
    padding: 10, alignItems: 'center', marginTop: 8,
  },
  editBtnText: { fontSize: 13, color: INK },
})
