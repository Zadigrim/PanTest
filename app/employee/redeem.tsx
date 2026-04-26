// Prize distribution — REQUIRED step 2 of the employee flow.
// This screen cannot be dismissed without logging a distribution choice.
// Both step 1 (scan) and step 2 (distribution) are logged to redemption_tokens.
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet, BackHandler, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { PrizeDistribution } from '../../components/employee/PrizeDistribution'
import { useEmployeeAccount, useRedemption } from '../../hooks/useEmployee'
import type { RedemptionToken } from '../../types'

export default function RedeemScreen() {
  const { tokenId } = useLocalSearchParams<{ tokenId: string }>()
  const [token, setToken] = useState<RedemptionToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { account } = useEmployeeAccount(userId ?? '')
  const { recordDistribution } = useRedemption()

  // Block hardware back button — step 2 is required
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Prize distribution required',
        'You must log the prize distribution before leaving this screen.',
        [{ text: 'OK' }]
      )
      return true // block back
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('redemption_tokens')
        .select(`
          *,
          passport_pages (
            section_name,
            prize_description
          )
        `)
        .eq('id', tokenId)
        .single()

      setToken(data)
      setLoading(false)
    }
    load()
  }, [tokenId])

  const handleRecordDistribution = async (params: {
    prizeGiven: string
    isPending: boolean
    extraGiftCardCents?: number
    note?: string
  }) => {
    if (!account || !tokenId) return false
    return recordDistribution({
      tokenId,
      employeeAccountId: account.id,
      ...params,
    })
  }

  const handleDistributed = () => {
    // Return to scanner for next collector
    router.replace('/employee')
  }

  if (loading || !token || !account) {
    return <View style={styles.centered}><ActivityIndicator color="#C9A84C" size="large" /></View>
  }

  return (
    <PrizeDistribution
      token={token as any}
      employeeAccountId={account.id}
      onDistributed={handleDistributed}
      onRecordDistribution={handleRecordDistribution}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
