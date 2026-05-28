// Designer — Pages route: two-page passport spread + draggable stamp boxes.
//
// Stamp positions live on the stops table (box_x / box_y / box_width /
// box_height) — the book renderer (components/passport/DesignerCanvas.tsx)
// reads them from there. Each stop on the active page has exactly one box;
// this screen lets the creator drag each stop's box into position on the
// right-hand spread page. The stamp_slots table (migration 004) is no
// longer used as the source of truth.
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

export default function PagesRoute() {
  useLocalSearchParams<{ id: string }>() // route param; pages provided via context
  const { pages, selectedId, selectedType, setSelection } = useDesigner()
  const { pageW, pageH } = useSpreadDimensions()

  const [stops, setStops] = useState<Stop[]>([])
  const [pageIdx, setPageIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  const activePage = pages[pageIdx] ?? null

  const loadStops = useCallback(async () => {
    if (!activePage) return
    setLoading(true)
    const { data } = await supabase
      .from('stops')
      .select('*')
      .eq('page_id', activePage.id)
      .order('stop_order', { ascending: true })
    setStops((data ?? []) as Stop[])
    setLoading(false)
  }, [activePage])

  useEffect(() => { void loadStops() }, [loadStops])

  // Drag updates the stop's box position. Optimistic local update + DB write.
  const moveStopBox = useCallback(async (stopId: string, posX: number, posY: number) => {
    setStops((curr) =>
      curr.map((s) => (s.id === stopId ? { ...s, box_x: posX, box_y: posY } : s)),
    )
    await supabase.from('stops').update({ box_x: posX, box_y: posY }).eq('id', stopId)
  }, [])

  const handleCanvasPress = useCallback(() => {
    setSelection(null, null)
  }, [setSelection])

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
      <ScrollView contentContainerStyle={s.canvas} showsVerticalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={1} onPress={handleCanvasPress}>
          <PassportSpread
            leftContent={<SectionDividerPreview page={activePage} />}
            rightContent={
              loading ? (
                <ActivityIndicator color={ACCENT} style={{ flex: 1 }} />
              ) : (
                <View style={{ flex: 1, position: 'relative' }}>
                  {stops.length === 0 && (
                    <Text style={s.tapHint}>Add stops on the Stops tab to position them here.</Text>
                  )}
                  {stops.map((stop) => (
                    <StampSlot
                      key={stop.id}
                      slot={{
                        id: stop.id,
                        stop_id: stop.id,
                        stop_name: stop.name,
                        pos_x: stop.box_x ?? 10,
                        pos_y: stop.box_y ?? 10,
                        width_pct: stop.box_width,
                        height_pct: stop.box_height,
                      }}
                      pageW={pageW}
                      pageH={pageH}
                      selected={selectedId === stop.id && selectedType === 'slot'}
                      onSelect={() => setSelection(stop.id, 'slot')}
                      onMove={moveStopBox}
                    />
                  ))}
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
          onPress={() => setPageIdx((i) => Math.max(0, i - 1))}
          disabled={pageIdx === 0}
        >
          <Text style={s.pagePickerArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.pagePickerLabel}>
          pp. {pageIdx * 2 + 2}–{pageIdx * 2 + 3} · {activePage?.section_name}
        </Text>
        <TouchableOpacity
          style={[s.pagePickerBtn, pageIdx >= pages.length - 1 && s.pagePickerBtnDisabled]}
          onPress={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
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
      {!!page.section_tagline && <Text style={div.tagline}>{page.section_tagline}</Text>}
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
    fontSize: 10, color: HAIRLINE, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 12,
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
