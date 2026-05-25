// Nearby mode — small map view at top, stop list below with "in range" / "walk Xm" distance pills.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
import { getCurrentLocation } from '../../lib/gps'
import { haversineDistance } from '../../lib/gps'
import { supabase } from '../../lib/supabase'
import { router } from 'expo-router'
import type { Stop, PassportPage } from '../../types'
import { palette } from '../../lib/colors'

interface NearbyStop extends Stop {
  passportId: string
  passportTitle: string
  pageId: string
  distanceM: number | null
  lat: number | null
  lng: number | null
}

// Parse PostGIS geography point returned as GeoJSON or WKT
function parsePoint(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null
  // GeoJSON: { type: 'Point', coordinates: [lng, lat] }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const geo = raw as Record<string, unknown>
    if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
      const [lng, lat] = geo.coordinates as number[]
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
    }
    // Plain { lat, lng } or { latitude, longitude }
    const lat = (geo.lat ?? geo.latitude) as number | undefined
    const lng = (geo.lng ?? geo.longitude) as number | undefined
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  }
  // WKT: "POINT(lng lat)"
  if (typeof raw === 'string') {
    const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
    if (m) return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) }
  }
  return null
}

const NAVY = palette.navy
const GOLD = palette.accent
const GREEN = palette.green
const INK = palette.ink
const MAP_HEIGHT_RATIO = 0.38

export default function NearbyMode() {
  const { height: sh } = useWindowDimensions()
  const [stops, setStops] = useState<NearbyStop[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<Region | null>(null)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // Attempt to get GPS location
    const loc = await getCurrentLocation()
    if (loc) {
      setUserLat(loc.latitude)
      setUserLng(loc.longitude)
      setRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      })
    }

    // Fetch published stops with their page + passport info
    const { data } = await supabase
      .from('stops')
      .select('*, page:passport_pages(id, passport_id, passport:passports(id, title, is_published))')
      .limit(200)

    const enriched: NearbyStop[] = []
    for (const s of data ?? []) {
      const page = s.page as any
      if (!page?.passport?.is_published) continue
      const coords = parsePoint(s.target_location)
      const distanceM =
        loc && coords
          ? haversineDistance(loc.latitude, loc.longitude, coords.lat, coords.lng)
          : null
      enriched.push({
        ...s,
        passportId: page.passport.id,
        passportTitle: page.passport.title,
        pageId: page.id,
        distanceM,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
    }

    // Sort by distance (nulls last)
    enriched.sort((a, b) => {
      if (a.distanceM === null && b.distanceM === null) return 0
      if (a.distanceM === null) return 1
      if (b.distanceM === null) return -1
      return a.distanceM - b.distanceM
    })

    setStops(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function DistancePill({ dist, radius }: { dist: number | null; radius: number }) {
    if (dist === null) return null
    const inRange = dist <= radius
    if (inRange) {
      return (
        <View style={[styles.pill, styles.pillGreen]}>
          <Text style={styles.pillTextGreen}>in range</Text>
        </View>
      )
    }
    const label = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`
    return (
      <View style={[styles.pill, styles.pillAmber]}>
        <Text style={styles.pillTextAmber}>walk {label}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={{ height: sh * MAP_HEIGHT_RATIO }}>
        {region ? (
          <MapView style={StyleSheet.absoluteFill} region={region} showsUserLocation>
            {stops
              .filter((s) => s.lat !== null && s.lng !== null)
              .map((s) => (
                <Marker
                  key={s.id}
                  coordinate={{ latitude: s.lat!, longitude: s.lng! }}
                  title={s.name}
                  description={s.passportTitle}
                  pinColor={
                    s.distanceM !== null && s.distanceM <= s.radius_meters
                      ? palette.green
                      : palette.accent
                  }
                />
              ))}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
            <Text style={styles.mapPlaceholderText}>Enable location for the map</Text>
          </View>
        )}
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
              <Text style={styles.emptyText}>No stops found nearby.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.stopRow}
              onPress={() => router.push(`/passport/${item.passportId}`)}
              activeOpacity={0.75}
            >
              <View style={styles.stopInfo}>
                <Text style={styles.stopName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.passportName} numberOfLines={1}>{item.passportTitle}</Text>
              </View>
              <DistancePill dist={item.distanceM} radius={item.radius_meters} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  mapPlaceholder: {
    backgroundColor: '#dde4ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontSize: 12,
    color: '#778899',
    fontStyle: 'italic',
  },
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
    fontSize: 14,
    fontWeight: '600',
    color: NAVY,
    fontFamily: 'serif',
    marginBottom: 2,
  },
  passportName: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillGreen: { backgroundColor: '#e6f7f1' },
  pillTextGreen: { fontSize: 10, color: GREEN, fontWeight: '700' },
  pillAmber: { backgroundColor: '#fdf5e4' },
  pillTextAmber: { fontSize: 10, color: '#b8860b', fontWeight: '600' },
})
