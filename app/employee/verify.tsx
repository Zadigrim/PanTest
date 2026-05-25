// Employee experience stamp verification (used for experience passport stops).
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { ExperienceVerifier } from '../../components/employee/ExperienceVerifier'
import { useEmployeeAccount, useRedemption } from '../../hooks/useEmployee'
import type { Stop } from '../../types'
import { palette } from '../../lib/colors'

export default function VerifyScreen() {
  const { stopId, stampId, isPageCompleting } = useLocalSearchParams<{
    stopId: string
    stampId: string
    isPageCompleting?: string
  }>()

  const [stop, setStop] = useState<Stop | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { account } = useEmployeeAccount(userId ?? '')
  const { verifyExperienceStamp } = useRedemption()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const { data } = await supabase.from('stops').select('*').eq('id', stopId).single()
      setStop(data)
      setLoading(false)
    }
    load()
  }, [stopId])

  const handleVerify = async (note?: string) => {
    if (!userId) return
    const success = await verifyExperienceStamp({ stampId, employeeUserId: userId, note })
    if (!success) {
      Alert.alert('Error', 'Could not record verification.')
      return
    }

    if (isPageCompleting === 'true') {
      // Navigate to prize distribution
      router.replace({
        pathname: '/employee/redeem',
        params: { fromVerify: 'true' },
      })
    } else {
      router.back()
    }
  }

  if (loading || !stop) return <View style={styles.centered}><ActivityIndicator color={palette.accent} /></View>

  return (
    <ExperienceVerifier
      stop={stop}
      isPageCompletingStop={isPageCompleting === 'true'}
      onVerify={handleVerify}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
