// Designer — Pages route: two-page passport spread + draggable stamp slots.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useDesigner } from './_layout'
import { PassportSpread, useSpreadDimensions } from '../../../components/designer/PassportSpread'
import { StampSlot } from '../../../components/designer/StampSlot'
import type { PassportPage, Stop } from '../../../types'
import { palette } from '../../../lib/colors'

const INK     = palette.ink
const MUTED   = palette.muted
const ACCENT  = palette.accent
const HAIRLINE = palette.hairline

interface SlotRecord {
  id: string
  page_id: string
  stop_id: string | null
  pos_x: number
  pos_y: number
  width_pct: number
  height_pct: number
  stops?: { name: string } | null
}

export default function PagesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pages, selectedId, selectedType, activeTool, setSelection } = useDesigner()
  const { pageW, pageH } = useSpreadDimensions()

  const [slots, setSlots] = useState<SlotRecord[]>([])
  const [pageIdx, setPageIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  const activePage = pages[pageIdx] ?? null

  const loadSlots = useCallback(async () => {
    if (!activePage) return
    const { data } = await supabase
      .from('stamp_slots')
      .select('*, stops(name)')
      .eq('page_id', activePage.id)
    setSlots((data ?? []) as SlotRecord[])
    setLoading(false)
  }, [activePage])

  useEffect(() => { setLoading(true); loadSlots() }, [loadSlots])

  const addSlot = async () => {
    if (!activePage) return
    const { data } = await supabase
      .from('stamp_slots')
      .insert({
        page_id: activePage.id,
        stop_id: null,
        pos_x: 20 + slots.length * 5,
        pos_y: 20 + slots.length * 5,
        width_pct: 40,
        height_pct: 25,
      })
      .select('*, stops(name)')
      .single()
    if (data) {
      setSlots(s => [...s, data as SlotRecord])
      setSelection(data.id, 'slot')
    }
  }

  const moveSlot = useCallback(async (slotId: string, posX: number, posY: number) => {
    setSlots(s => s.map(sl => sl.id === slotId ? { ...sl, pos_x: posX, pos_y: posY } : sl))
    await supabase.from('stamp_slots').update({ pos_x: posX, pos_y: posY }).eq('id', slotId)
  }, [])

  const handleCanvasPress = useCallback(() => {
    if (activeTool === 'slot') addSlot()
    else setSelection(null, null)
  }, [activeTool, addSlot, setSelection])

  if (pages.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={s.hint}>No sections yet. Add one in the left rail.</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Spread canvas */}
      <ScrollView
        contentContainerStyle={s.canvas}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity activeOpacity={1} onPress={handleCanvasPress}>
          <PassportSpread
            leftContent={
              <SectionDividerPreview page={activePage} />
            }
            rightContent={
              loading
                ? <ActivityIndicator color={ACCENT} style={{ flex: 1 }} />
                : (
                  <View style={{ flex: 1, position: 'relative' }}>
                    {slots.map(slot => (
                      <StampSlot
                        key={slot.id}
                        slot={{
                          id: slot.id,
                          stop_id: slot.stop_id,
                          stop_name: (slot.stops as any)?.name ?? null,
                          pos_x: slot.pos_x,
                          pos_y: slot.pos_y,
                          width_pct: slot.width_pct,
                          height_pct: slot.height_pct,
                        }}
                        pageW={pageW}
                        pageH={pageH}
                        selected={selectedId === slot.id && selectedType === 'slot'}
                        onSelect={() => setSelection(slot.id, 'slot')}
                        onMove={moveSlot}
                      />
                    ))}
                    {activeTool === 'slot' && slots.length === 0 && (
                      <Text style={s.tapHint}>Tap to place a stamp slot</Text>
                    )}
                  </View>
                )
            }
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Page picker */}
      <View style={s.pagePicker}>
        <TouchableOpacity
          style={[s.pagePickerBtn, pageIdx === 0 && s.pagePickerBtnDisabled]}
          onPress={() => setPageIdx(i => Math.max(0, i - 1))}
          disabled={pageIdx === 0}
        >
          <Text style={s.pagePickerArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.pagePickerLabel}>
          pp. {pageIdx * 2 + 2}–{pageIdx * 2 + 3} · {activePage?.section_name}
        </Text>
        <TouchableOpacity
          style={[s.pagePickerBtn, pageIdx >= pages.length - 1 && s.pagePickerBtnDisabled]}
          onPress={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}
          disabled={pageIdx >= pages.length - 1}
        >
          <Text style={s.pagePickerArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function SectionDividerPreview({ page }: { page: PassportPage | null }) {
  if (!page) return null
  return (
    <View style={div.root}>
      <Text style={div.chapterLabel}>CHAPTER</Text>
      <Text style={div.sectionName}>{page.section_name}</Text>
      {!!page.section_tagline && (
        <Text style={div.tagline}>{page.section_tagline}</Text>
      )}
      {!!page.prize_description && (
        <View style={div.prizeHint}>
          <Text style={div.prizeLabel}>Prize</Text>
          <Text style={div.prizeText}>{page.prize_description}</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e1d2' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: MUTED, fontStyle: 'italic' },
  canvas: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  tapHint: {
    position: 'absolute', top: '45%', alignSelf: 'center',
    fontSize: 10, color: HAIRLINE, fontStyle: 'italic',
  },
  pagePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.cream, borderTopWidth: 1, borderTopColor: HAIRLINE,
    paddingVertical: 8, gap: 16,
  },
  pagePickerBtn: { padding: 6 },
  pagePickerBtnDisabled: { opacity: 0.3 },
  pagePickerArrow: { fontSize: 20, color: INK },
  pagePickerLabel: { fontSize: 12, color: MUTED },
})

const div = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  chapterLabel: { fontSize: 8, letterSpacing: 2, color: MUTED, textTransform: 'uppercase' },
  sectionName: { fontSize: 18, fontWeight: '700', color: INK, textAlign: 'center' },
  tagline: { fontSize: 11, color: MUTED, fontStyle: 'italic', textAlign: 'center' },
  prizeHint: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 4,
    padding: 6, marginTop: 8, alignItems: 'center', width: '80%',
  },
  prizeLabel: { fontSize: 8, color: ACCENT, letterSpacing: 1, textTransform: 'uppercase' },
  prizeText: { fontSize: 11, color: INK, textAlign: 'center', marginTop: 2 },
})
