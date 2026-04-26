// PanoplyConnect employee terminal — scan token (step 1 of 2).
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { TokenScanner } from '../../components/employee/TokenScanner'
import { useEmployeeAccount, useTokenScanner, useRedemption } from '../../hooks/useEmployee'
import { getCurrentUser } from '../../lib/supabase'

export default function EmployeeIndexScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const { account, loading: accountLoading } = useEmployeeAccount(userId ?? '')
  const { scanning, token, error, scanToken } = useTokenScanner()
  const { recordScan } = useRedemption()

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)
    }
    loadUser()
  }, [])

  const handleTokenScanned = async (code: string) => {
    const result = await scanToken(code)
    if (!result || !account) return

    // Record step 1: token scanned
    await recordScan(result.id, account.id)

    // Navigate to prize distribution (required step 2)
    router.push({
      pathname: '/employee/redeem',
      params: { tokenId: result.id, tokenCode: result.token_code },
    })
  }

  if (accountLoading || !userId) {
    return <View style={styles.centered}><ActivityIndicator color="#C9A84C" size="large" /></View>
  }

  if (!account) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          No active employee account found. Contact your manager.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.employeeName}>{account.employee_name}</Text>
        <Text style={styles.headerHint}>Scan collector's redemption token</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <TokenScanner onTokenScanned={handleTokenScanned} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B2A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0D1B2A' },
  header: {
    padding: 16,
    backgroundColor: '#152232',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2d44',
  },
  employeeName: { fontSize: 16, fontWeight: '700', color: '#F5F0E8' },
  headerHint: { fontSize: 12, color: '#888', marginTop: 2 },
  errorText: { color: '#F5F0E8', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  errorBanner: {
    backgroundColor: '#C0392B',
    padding: 12,
    margin: 12,
    borderRadius: 8,
  },
  errorBannerText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
})
