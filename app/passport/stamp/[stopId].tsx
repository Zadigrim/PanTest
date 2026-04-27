// Standalone stamp screen — used for QR-triggered or deep-linked stamp flow.
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../../lib/supabase'
import { useGPS, useStampVerification } from '../../../hooks/useGPS'
import { StampArtwork } from '../../../components/stamp/StampArtwork'
import type { Stop } from '../../../types'

export default function StampScreen() {
  const { stopId, qrCodeId } = useLocalSearchParams<{ stopId: string; qrCodeId?: string }>()
  const [stop, setStop] = useState<Stop | null>(null)
  const [collectorPassportId, setCollectorPassportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stamped, setStamped] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const { checkLocation } = useGPS()
  const { verify } = useStampVerification()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }

      const { data: stopData } = await supabase
        .from('stops')
        .select('*, passport_pages(passport_id)')
        .eq('id', stopId)
        .single()

      if (!stopData) { setLoading(false); return }
      setStop(stopData)

      const passportId = (stopData as any).passport_pages?.passport_id
      if (passportId) {
        const { data: cp } = await supabase
          .from('collector_passports')
          .select('id')
          .eq('user_id', user.id)
          .eq('passport_id', passportId)
          .single()
        setCollectorPassportId(cp?.id ?? null)
      }

      // Check if already stamped
      const { data: existing } = await supabase
        .from('stamps')
        .select('id')
        .eq('stop_id', stopId)
        .eq('user_id', user.id)
        .single()
      if (existing) setStamped(true)

      setLoading(false)
    }
    load()
  }, [stopId])

  const handleStamp = async () => {
    setVerifying(true)
    const user = await getCurrentUser()
    if (!user) { router.push('/(auth)/login'); return }

    if (!collectorPassportId) {
      Alert.alert('Passport needed', 'You need to acquire this passport before stamping.')
      setVerifying(false)
      return
    }

    const location = await checkLocation()
    if (!location) {
      Alert.alert('Location needed', 'Enable location to stamp this stop.')
      setVerifying(false)
      return
    }

    const stopOpenedAt = new Date().toISOString()
    const result = await verify({
      stopId,
      latitude: location.latitude,
      longitude: location.longitude,
      qrCodeId: qrCodeId,
      stopOpenedAt,
    })

    if (!result?.verified) {
      Alert.alert('Not verified', result?.reason ?? 'Could not confirm your location.')
      setVerifying(false)
      return
    }

    const { error } = await supabase.from('stamps').insert({
      user_id: user.id,
      stop_id: stopId,
      collector_passport_id: collectorPassportId,
      geohash: result.geohash,
      verification_method: result.verificationMethod,
      stop_opened_at: stopOpenedAt,
      verified_at: new Date().toISOString(),
    })

    setVerifying(false)
    if (error) { Alert.alert('Error', error.message); return }
    setStamped(true)
  }

  if (loading) return <ActivityIndicator style={styles.centered} color="#C9A84C" />

  return (
    <View style={styles.container}>
      {stop && (
        <>
          <Text style={styles.name}>{stop.name}</Text>
          <Text style={styles.location}>{stop.location_name}</Text>
          <View style={styles.artContainer}>
            <StampArtwork stop={stop} size={140} ghost={!stamped} />
          </View>
          {stamped ? (
            <Text style={styles.success}>✓ Stamped!</Text>
          ) : (
            <TouchableOpacity
              style={[styles.btn, verifying && styles.btnDisabled]}
              onPress={handleStamp}
              disabled={verifying}
            >
              <Text style={styles.btnText}>{verifying ? 'Verifying…' : 'Stamp this location'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  centered: { flex: 1 },
  name: { fontSize: 24, fontWeight: '700', color: '#0D1B2A', fontFamily: 'serif', textAlign: 'center' },
  location: { fontSize: 14, color: '#888', fontStyle: 'italic', marginTop: 4, marginBottom: 32 },
  artContainer: { marginBottom: 40 },
  success: { fontSize: 24, color: '#1D9E75', fontWeight: '700' },
  btn: {
    backgroundColor: '#0D1B2A', borderRadius: 12, padding: 18,
    paddingHorizontal: 40, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#F5F0E8', fontWeight: '700', fontSize: 16 },
})
