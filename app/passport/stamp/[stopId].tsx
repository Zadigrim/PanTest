// Standalone stamp screen — used for QR-triggered or deep-linked stamp flow.
import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Modal, SafeAreaView,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../../lib/supabase'
import { useGPS, useStampVerification } from '../../../hooks/useGPS'
import { useDemoContext } from '../../../contexts/DemoContext'
import { StampArtwork } from '../../../components/stamp/StampArtwork'
import type { Stop } from '../../../types'
import { palette } from '../../../lib/colors'

export default function StampScreen() {
  const { stopId, qrCodeId } = useLocalSearchParams<{ stopId: string; qrCodeId?: string }>()
  const [stop, setStop] = useState<Stop | null>(null)
  const [collectorPassportId, setCollectorPassportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stamped, setStamped] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [visitorCode, setVisitorCode] = useState('')
  const { checkLocation } = useGPS()
  const { verify } = useStampVerification()
  const { demoActive } = useDemoContext()

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

      // Derive visitor code from userId (first 6 chars, uppercase)
      setVisitorCode(user.id.replace(/-/g, '').slice(0, 6).toUpperCase())

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

  // verify-stamp verifies AND writes the stamp (the only stamp writer
  // since migration 026 — client INSERT on stamps is revoked). Demo mode
  // sends demo: true; the function honors it only for server-authorized
  // demo users and marks the row is_demo.
  const handleStamp = async () => {
    setVerifying(true)
    const user = await getCurrentUser()
    if (!user) { router.push('/(auth)/login'); return }

    if (!collectorPassportId) {
      Alert.alert('Passport needed', 'You need to acquire this passport before stamping.')
      setVerifying(false)
      return
    }

    const stopOpenedAt = new Date().toISOString()
    let result
    if (demoActive) {
      result = await verify({ stopId, latitude: 0, longitude: 0, stopOpenedAt, demo: true })
    } else {
      const location = await checkLocation()
      if (!location) {
        Alert.alert('Location needed', 'Enable location to stamp this stop.')
        setVerifying(false)
        return
      }
      result = await verify({
        stopId,
        latitude: location.latitude,
        longitude: location.longitude,
        qrCodeId: qrCodeId,
        stopOpenedAt,
      })
    }

    setVerifying(false)
    if (!result?.verified || !result.stamp) {
      Alert.alert('Not verified', result?.reason ?? 'Could not confirm your location.')
      return
    }
    setStamped(true)
  }

  if (loading) return <ActivityIndicator style={styles.centered} color={palette.accent} />

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

          {/* Employee code button — always visible */}
          <TouchableOpacity style={styles.codeBtn} onPress={() => setShowCode(true)}>
            <Text style={styles.codeBtnText}>Show code for employee</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Visitor code modal */}
      <Modal
        visible={showCode}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCode(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Your visitor code</Text>
            <Text style={styles.modalCode}>{visitorCode}</Text>
            <Text style={styles.modalHint}>
              Show this to the ranger or librarian at this stop
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCode(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  centered: { flex: 1 },
  name: { fontSize: 24, fontWeight: '700', color: palette.navy, fontFamily: 'serif', textAlign: 'center' },
  location: { fontSize: 14, color: '#888', fontStyle: 'italic', marginTop: 4, marginBottom: 32 },
  artContainer: { marginBottom: 40 },
  success: { fontSize: 24, color: palette.green, fontWeight: '700' },
  btn: {
    backgroundColor: palette.navy, borderRadius: 12, padding: 18,
    paddingHorizontal: 40, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: palette.cream, fontWeight: '700', fontSize: 16 },
  // Employee code
  codeBtn: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 },
  codeBtnText: { fontSize: 13, color: '#aaa', textDecorationLine: 'underline' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.navy, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 32, alignItems: 'center',
  },
  modalTitle: {
    fontSize: 14, color: '#888', fontStyle: 'italic', marginBottom: 20,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  modalCode: {
    fontSize: 56, fontFamily: 'monospace', fontWeight: '700',
    color: palette.accent, letterSpacing: 8, marginBottom: 20,
  },
  modalHint: {
    fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 32,
  },
  modalClose: {
    backgroundColor: '#152232', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40,
  },
  modalCloseText: { color: palette.cream, fontWeight: '600', fontSize: 15 },
})
