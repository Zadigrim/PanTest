// Employee Terminal — Step 2 of 2 (REQUIRED).
// Three outcome buttons: Given / Pending / Refused.
// Back navigation is blocked until an outcome is recorded.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler, Alert,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { GiftCardExtra } from '../../components/employee/GiftCardExtra'
import { useEmployeeAccount, useRedemption } from '../../hooks/useEmployee'
import { useCounterRefresh } from './_layout'
import type { RedemptionToken } from '../../types'

const INK    = '#1f1d1a'
const MUTED  = '#6b6356'
const ACCENT = '#c9a84c'
const GREEN  = '#1d9e75'
const RED    = '#9b2335'
const HAIRLINE = '#c8bfa9'

type TokenWithPage = RedemptionToken & {
  passport_pages?: { section_name: string; prize_description: string | null; passports?: { title: string } }
}

export default function RedeemScreen() {
  const { tokenId } = useLocalSearchParams<{ tokenId: string }>()
  const [token, setToken] = useState<TokenWithPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const { account } = useEmployeeAccount(userId ?? '')
  const { submitting, recordDistribution } = useRedemption()
  const { refresh } = useCounterRefresh()
  const [giftCardAmount, setGiftCardAmount] = useState<number | null>(null)
  const [giftCardNote, setGiftCardNote] = useState('')

  // Block Android hardware back — step 2 is required
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Step 2 is required',
        'Record an outcome before leaving this screen.',
        [{ text: 'OK' }],
      )
      return true
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
            prize_description,
            passports ( title )
          )
        `)
        .eq('id', tokenId)
        .single()

      setToken(data as TokenWithPage)
      setLoading(false)
    }
    load()
  }, [tokenId])

  const complete = useCallback(async (outcome: 'given' | 'pending' | 'refused') => {
    if (!account || !tokenId) return

    const success = await recordDistribution({
      tokenId,
      employeeAccountId: account.id,
      prizeGiven: prize,
      isPending: outcome === 'pending',
      extraGiftCardCents: giftCardAmount ?? undefined,
      note: outcome === 'refused' ? 'Refused / unavailable' : giftCardNote || undefined,
    })

    if (!success) {
      Alert.alert('Error', 'Could not save outcome. Try again.')
      return
    }

    refresh()
    router.replace('/employee')
  }, [account, tokenId, giftCardAmount, giftCardNote, recordDistribution, refresh])

  if (loading || !token || !account) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  const page = (token as any).passport_pages
  const prize = page?.prize_description ?? 'Prize'
  const section = page?.section_name ?? ''
  const passportTitle = page?.passports?.title ?? ''

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Step header */}
      <View style={s.stepHeader}>
        <Text style={s.stepLabel}>STEP 2 OF 2 · REQUIRED</Text>
        <Text style={s.stepTitle}>{prize}</Text>
        <Text style={s.subline}>
          {[passportTitle, section, token.token_code].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {/* Outcome buttons */}
      <View style={s.outcomes}>
        <TouchableOpacity
          style={[s.outcomeBtn, s.givenBtn, submitting && s.btnDisabled]}
          onPress={() => complete('given')}
          disabled={submitting}
        >
          <Text style={s.givenBtnText}>✓  Given</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.outcomeBtn, s.pendingBtn, submitting && s.btnDisabled]}
          onPress={() => complete('pending')}
          disabled={submitting}
        >
          <Text style={s.pendingBtnText}>⏱  Pending — they'll come back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.outcomeBtn, s.refusedBtn, submitting && s.btnDisabled]}
          onPress={() =>
            Alert.alert('Refuse redemption?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Refuse', style: 'destructive', onPress: () => complete('refused') },
            ])
          }
          disabled={submitting}
        >
          <Text style={s.refusedBtnText}>✕  Refused / unavailable</Text>
        </TouchableOpacity>
      </View>

      {/* Optional gift card */}
      <GiftCardExtra
        value={giftCardAmount}
        note={giftCardNote}
        onAmountChange={setGiftCardAmount}
        onNoteChange={setGiftCardNote}
      />

      {/* Required notice */}
      <Text style={s.requiredNote}>
        ⚠  This step is required — back button is disabled
      </Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 28, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  stepHeader: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece3',
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2.5,
    color: RED, textTransform: 'uppercase', marginBottom: 6,
  },
  stepTitle: { fontSize: 26, fontWeight: '700', color: INK, marginBottom: 6 },
  subline: { fontSize: 13, color: MUTED },

  outcomes: { gap: 12, marginBottom: 24 },
  outcomeBtn: {
    borderRadius: 4, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },

  givenBtn: { backgroundColor: GREEN },
  givenBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  pendingBtn: { borderWidth: 1.5, borderColor: HAIRLINE, backgroundColor: '#fff' },
  pendingBtnText: { color: MUTED, fontSize: 15, fontWeight: '500' },

  refusedBtn: { borderWidth: 1.5, borderColor: RED, backgroundColor: '#fff' },
  refusedBtnText: { color: RED, fontSize: 15, fontWeight: '500' },

  requiredNote: {
    marginTop: 28,
    fontSize: 11,
    color: MUTED,
    fontStyle: 'italic',
    textAlign: 'center',
  },
})
