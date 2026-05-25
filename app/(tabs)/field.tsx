// Employee field home — lists authorized stops for the employee's institution.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'

interface FieldStop {
  id: string
  name: string
  passport_title: string
  verification_type: string | null
}

export default function FieldHomeScreen() {
  const { employeeAuth, employeeMode } = useEmployeeContext()
  const [stops, setStops] = useState<FieldStop[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const user = await getCurrentUser()
    if (!user) { router.replace('/(auth)/login'); return }

    // Fetch display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (profile) setDisplayName(profile.display_name)

    if (!employeeAuth?.institution_id) {
      setStops([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Fetch published stops for the institution via passports → passport_pages → stops
    const { data: stopsData } = await supabase
      .from('stops')
      .select(`
        id,
        name,
        verification_type,
        passport_pages (
          passports (
            id,
            title,
            is_published,
            creator_id,
            proprietor_id
          )
        )
      `)
      .order('stop_order', { ascending: true })

    if (stopsData) {
      const institutionId = employeeAuth.institution_id
      const filtered: FieldStop[] = []

      for (const stop of stopsData) {
        const page = (stop as any).passport_pages
        const passport = page?.passports
        if (!passport) continue
        if (!passport.is_published) continue
        // Include if this institution is creator or proprietor
        if (
          passport.creator_id === institutionId ||
          passport.proprietor_id === institutionId
        ) {
          filtered.push({
            id: stop.id,
            name: stop.name,
            passport_title: passport.title,
            verification_type: stop.verification_type,
          })
        }
      }

      setStops(filtered)
    }

    setLoading(false)
    setRefreshing(false)
  }, [employeeAuth])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load()
  }, [load])

  if (!employeeMode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.offText}>Enable employee mode in Profile to use the field tools.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    )
  }

  const hasQr = stops.some(
    (s) => !s.verification_type || s.verification_type === 'qr' || s.verification_type === 'qr_gps'
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.institution}>{employeeAuth?.institution_name ?? 'Your Institution'}</Text>
        <Text style={styles.greeting}>
          {displayName ? `Welcome, ${displayName.split(' ')[0]}` : 'Welcome'}
        </Text>
      </View>

      {hasQr && (
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push('/field/scan')}
          activeOpacity={0.85}
        >
          <Text style={styles.scanBtnText}>📷  Scan a visitor</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={stops}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
        renderItem={({ item }) => {
          const isGps = item.verification_type === 'gps_area'
          return (
            <TouchableOpacity
              style={styles.stopRow}
              onPress={() => router.push({ pathname: '/field/lookup', params: { stopId: item.id } })}
              activeOpacity={0.8}
            >
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{item.name}</Text>
                <Text style={styles.passportTitle}>{item.passport_title}</Text>
              </View>
              <View style={styles.stopMeta}>
                <Text style={styles.verifyIcon}>
                  {isGps ? '📍' : '🔲'}
                </Text>
                {isGps && (
                  <Text style={styles.hereText}>Visitor is here →</Text>
                )}
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No active stops found for your institution.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.navy, padding: 32,
  },
  offText: { color: '#888', textAlign: 'center', fontSize: 15, fontStyle: 'italic' },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a2d44',
  },
  institution: {
    fontSize: 11, color: palette.accent, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
  },
  greeting: { fontSize: 22, color: palette.cream, fontFamily: 'serif' },
  scanBtn: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    backgroundColor: palette.green, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  list: { padding: 16, gap: 10 },
  stopRow: {
    backgroundColor: '#152232', borderRadius: 10, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#1a2d44',
  },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 16, color: palette.cream, fontWeight: '600', fontFamily: 'serif' },
  passportTitle: { fontSize: 12, color: '#888', marginTop: 3, fontStyle: 'italic' },
  stopMeta: { alignItems: 'flex-end', marginLeft: 12 },
  verifyIcon: { fontSize: 20 },
  hereText: { fontSize: 11, color: palette.accent, marginTop: 3 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#555', fontStyle: 'italic', textAlign: 'center', fontSize: 14 },
})
