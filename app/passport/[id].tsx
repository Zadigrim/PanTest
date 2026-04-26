// Passport book view — page-turning experience.
import React, { useEffect, useCallback, useState } from 'react'
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PassportBook } from '../../components/passport/PassportBook'
import { usePassport } from '../../hooks/usePassport'
import { useGPS, useStampVerification } from '../../hooks/useGPS'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { checkPageComplete, generateTokenForPage } from '../../lib/token'
import type { StampPlacement, StampSlotState, Stop } from '../../types'

export default function PassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { passport, pages, stops, loading } = usePassport(id)
  const [stamps, setStamps] = useState<Record<string, Record<string, any>>>({})
  const [slotStates, setSlotStates] = useState<Record<string, Record<string, StampSlotState>>>({})
  const [collectorPassportId, setCollectorPassportId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const { state: gpsState, checkLocation } = useGPS()
  const { verify } = useStampVerification()

  useEffect(() => {
    async function init() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const { data: cp } = await supabase
        .from('collector_passports')
        .select('id')
        .eq('user_id', user.id)
        .eq('passport_id', id)
        .single()

      if (!cp) { router.back(); return }
      setCollectorPassportId(cp.id)

      // Load existing stamps
      const { data: allStamps } = await supabase
        .from('stamps')
        .select('*, stop:stops(page_id)')
        .eq('user_id', user.id)

      const byPage: Record<string, Record<string, any>> = {}
      for (const s of allStamps ?? []) {
        const pageId = s.stop?.page_id
        if (!pageId) continue
        if (!byPage[pageId]) byPage[pageId] = {}
        byPage[pageId][s.stop_id] = s
      }
      setStamps(byPage)

      // Initialize slot states — dormant by default; GPS probe to transition to ready
      const initial: Record<string, Record<string, StampSlotState>> = {}
      for (const p of pages ?? []) {
        initial[p.id] = {}
        for (const stop of stops[p.id] ?? []) {
          initial[p.id][stop.id] = byPage[p.id]?.[stop.id] ? 'stamped' : 'dormant'
        }
      }
      setSlotStates(initial)
    }
    if (!loading) init()
  }, [loading, id, pages])

  const handlePressStart = useCallback(async (pageId: string, stopId: string) => {
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'pressing' },
    }))
  }, [])

  const handlePressCancel = useCallback((pageId: string, stopId: string) => {
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'ready' },
    }))
  }, [])

  const handleStampPlaced = useCallback(async (pageId: string, stopId: string, placement: StampPlacement) => {
    if (!userId || !collectorPassportId) return

    // Get location for verification
    const location = await checkLocation()
    if (!location) {
      Alert.alert('Location needed', 'Enable location access to stamp this stop.')
      handlePressCancel(pageId, stopId)
      return
    }

    const stopOpenedAt = new Date().toISOString()
    const result = await verify({
      stopId,
      latitude: location.latitude,
      longitude: location.longitude,
      stopOpenedAt,
    })

    if (!result?.verified) {
      Alert.alert(
        'Not quite there',
        result?.reason ?? 'You need to be at the location to stamp.'
      )
      handlePressCancel(pageId, stopId)
      return
    }

    const { data: stampData, error } = await supabase
      .from('stamps')
      .insert({
        user_id: userId,
        stop_id: stopId,
        collector_passport_id: collectorPassportId,
        geohash: result.geohash,
        stamp_pos_x: placement.posX,
        stamp_pos_y: placement.posY,
        contact_size_px: placement.contactSizePx,
        rotation_deg: placement.rotationDeg,
        verification_method: result.verificationMethod,
        stop_opened_at: stopOpenedAt,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      Alert.alert('Error', 'Could not save stamp.')
      handlePressCancel(pageId, stopId)
      return
    }

    setStamps((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: stampData },
    }))
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'stamped' },
    }))

    // Check if page is now complete
    const isComplete = await checkPageComplete(pageId, userId)
    if (isComplete) {
      try {
        const token = await generateTokenForPage(pageId, userId)
        Alert.alert(
          '★ Page Complete!',
          `Your redemption code: ${token.token_code}\n\nShow this at the location to claim your prize.`,
          [
            { text: 'View Journal', onPress: () => router.push(`/journal/${stampData.id}`) },
            { text: 'Done' },
          ]
        )
      } catch {
        Alert.alert('Page complete!', 'All stops stamped.')
      }
    } else {
      // Offer journal entry
      Alert.alert('Stamped!', 'Want to add a journal entry?', [
        { text: 'Yes', onPress: () => router.push(`/journal/${stampData.id}`) },
        { text: 'Skip' },
      ])
    }
  }, [userId, collectorPassportId, checkLocation, verify, handlePressCancel])

  // GPS probe: transition dormant stops to ready
  useEffect(() => {
    async function probeGPS() {
      const location = await checkLocation()
      if (!location) return

      setSlotStates((prev) => {
        const updated = { ...prev }
        for (const pageId of Object.keys(updated)) {
          for (const stopId of Object.keys(updated[pageId])) {
            if (updated[pageId][stopId] === 'dormant') {
              updated[pageId] = { ...updated[pageId], [stopId]: 'ready' }
            }
          }
        }
        return updated
      })
    }
    if (!loading && passport) probeGPS()
  }, [loading, passport])

  if (loading || !passport) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  return (
    <PassportBook
      passport={passport}
      pages={pages}
      stops={stops}
      stamps={stamps}
      slotStates={slotStates}
      onStampPlaced={handleStampPlaced}
      onPressStart={handlePressStart}
      onPressCancel={handlePressCancel}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
})
