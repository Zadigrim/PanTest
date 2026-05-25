// Web-safe NearbyMode — no MapView (react-native-maps has no web build).
// Shows a placeholder banner and the full stop list without GPS distance.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { palette } from '../../lib/colors'

interface NearbyStop {
  id: string
  name: string
  location_name: string | null
  radius_meters: number
  passportId: string
  passportTitle: string
}

const NAVY = palette.navy
const GOLD = palette.accent

export default function NearbyMode() {
  const [stops, setStops] = useState<NearbyStop[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stops')
      .select('id, name, location_name, radius_meters, page:passport_pages(id, passport:passports(id, title, is_published))')
      .limit(200)

    const enriched: NearbyStop[] = []
    for (const s of data ?? []) {
      const page = (s.page as any)
      if (!page?.passport?.is_published) continue
      enriched.push({
        id: s.id,
        name: s.name,
        location_name: s.location_name,
        radius_meters: s.radius_meters,
        passportId: page.passport.id,
        passportTitle: page.passport.title,
      })
    }
    setStops(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <View style={styles.container}>
      {/* Map placeholder */}
      <View style={styles.mapBanner}>
        <Text style={styles.mapIcon}>🗺</Text>
        <Text style={styles.mapText}>Map view available on mobile</Text>
        <Text style={styles.mapSub}>Install Expo Go on your phone to see the live map</Text>
      </View>

      {/* Stop list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No stops found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.stopRow}
              onPress={() => router.push(`/passport/${item.passportId}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{item.name}</Text>
                <Text style={styles.passportName}>{item.passportTitle}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>view</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  mapBanner: {
    height: 140,
    backgroundColor: '#dde4ec',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccd3db',
  },
  mapIcon: { fontSize: 28, marginBottom: 6 },
  mapText: { fontSize: 13, fontWeight: '600', color: '#556677' },
  mapSub: { fontSize: 11, color: '#889aaa', marginTop: 3, fontStyle: 'italic' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list: { paddingVertical: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#aaa', fontStyle: 'italic' },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  stopInfo: { flex: 1, marginRight: 10 },
  stopName: {
    fontSize: 14, fontWeight: '600', color: NAVY,
    fontFamily: 'serif', marginBottom: 2,
  },
  passportName: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  pill: {
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: '#eee',
  },
  pillText: { fontSize: 10, color: '#666', fontWeight: '600' },
})
