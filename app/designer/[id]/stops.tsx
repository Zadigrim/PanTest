// Designer — Stops route: map + list rail.
// Numbered pins on map; inspector (in right panel) shows stop details.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useDesigner } from './_layout'
import type { Stop, PassportPage } from '../../../types'

const INK     = '#1f1d1a'
const MUTED   = '#6b6356'
const ACCENT  = '#c9a84c'
const HAIRLINE = '#c8bfa9'
const NAVY    = '#0d1b2a'

interface StopWithPage extends Stop { page?: { section_name: string } }

export default function StopsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pages, selectedId, selectedType, setSelection } = useDesigner()
  const [stops, setStops] = useState<StopWithPage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const pageIds = pages.map(p => p.id)
    if (pageIds.length === 0) { setLoading(false); return }
    const { data } = await supabase
      .from('stops')
      .select('*, page:passport_pages(section_name)')
      .in('page_id', pageIds)
      .order('stop_order')
    setStops((data ?? []) as StopWithPage[])
    setLoading(false)
  }, [pages])

  useEffect(() => { setLoading(true); load() }, [load])

  const addStop = async () => {
    const firstPage = pages[0]
    if (!firstPage) return
    const { data } = await supabase
      .from('stops')
      .insert({
        page_id: firstPage.id,
        name: 'New Stop',
        stop_order: stops.length + 1,
        radius_meters: 50,
        verify_mode: 'gps',
      })
      .select('*, page:passport_pages(section_name)')
      .single()
    if (data) {
      setStops(s => [...s, data as StopWithPage])
      setSelection(data.id, 'stop')
    }
  }

  const grouped: Record<string, StopWithPage[]> = {}
  for (const stop of stops) {
    const key = (stop as any).page?.section_name ?? 'Unassigned'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(stop)
  }

  return (
    <View style={s.container}>
      {/* Map area */}
      <View style={s.mapArea}>
        <MapPlaceholder stops={stops} selectedId={selectedId} onSelect={id => setSelection(id, 'stop')} />
      </View>

      {/* Stop list */}
      <View style={s.listArea}>
        <View style={s.listHeader}>
          <Text style={s.listTitle}>Stops</Text>
          <TouchableOpacity style={s.addBtn} onPress={addStop}>
            <Text style={s.addBtnText}>+ Add stop</Text>
          </TouchableOpacity>
        </View>
        {loading
          ? <ActivityIndicator color={ACCENT} style={{ flex: 1 }} />
          : (
            <FlatList
              data={stops}
              keyExtractor={s => s.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[s.stopRow, selectedId === item.id && s.stopRowActive]}
                  onPress={() => setSelection(item.id, 'stop')}
                >
                  <View style={s.stopNum}>
                    <Text style={s.stopNumText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.stopName}>{item.name}</Text>
                    <Text style={s.stopSection}>{(item as any).page?.section_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push(`/designer/stop/${item.id}` as any)}>
                    <Text style={s.editLink}>edit ›</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={s.emptyText}>No stops yet. Click on the map or tap "+ Add stop".</Text>
              }
              contentContainerStyle={stops.length === 0 && s.emptyCont}
            />
          )
        }
      </View>
    </View>
  )
}

function MapPlaceholder({
  stops, selectedId, onSelect,
}: { stops: StopWithPage[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (Platform.OS !== 'web') {
    // On native, try to render MapView
    try {
      const MapView = require('react-native-maps').default
      const Marker  = require('react-native-maps').Marker
      return (
        <MapView style={{ flex: 1 }} initialRegion={{ latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
          {stops.map((stop) => {
            const loc = (stop as any).target_location
            const lat = loc?.coordinates?.[1] ?? loc?.lat ?? null
            const lng = loc?.coordinates?.[0] ?? loc?.lng ?? null
            if (!lat || !lng) return null
            return (
              <Marker
                key={stop.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={stop.name}
                onPress={() => onSelect(stop.id)}
              />
            )
          })}
        </MapView>
      )
    } catch { /* fall through to placeholder */ }
  }

  return (
    <View style={mp.root}>
      <Text style={mp.icon}>🗺</Text>
      <Text style={mp.text}>Map view</Text>
      <Text style={mp.sub}>{stops.length} stop{stops.length !== 1 ? 's' : ''} placed</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#e8e1d2' },
  mapArea: { flex: 1 },
  listArea: {
    width: 240, backgroundColor: '#f5f0e8',
    borderLeftWidth: 1, borderLeftColor: HAIRLINE,
  },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  listTitle: { fontSize: 13, fontWeight: '700', color: INK },
  addBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: ACCENT, borderRadius: 4,
  },
  addBtnText: { fontSize: 11, color: ACCENT, fontWeight: '600' },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE,
  },
  stopRowActive: { backgroundColor: 'rgba(201,168,76,0.1)' },
  stopNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
  },
  stopNumText: { fontSize: 10, color: '#f5f0e8', fontWeight: '700' },
  stopName: { fontSize: 13, fontWeight: '600', color: INK },
  stopSection: { fontSize: 10, color: MUTED, marginTop: 1 },
  editLink: { fontSize: 11, color: MUTED },
  emptyText: { fontSize: 12, color: HAIRLINE, fontStyle: 'italic', padding: 16, lineHeight: 18 },
  emptyCont: { flex: 1 },
})

const mp = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ddd2b6', gap: 6 },
  icon: { fontSize: 32 },
  text: { fontSize: 14, fontWeight: '600', color: MUTED },
  sub: { fontSize: 11, color: HAIRLINE },
})
