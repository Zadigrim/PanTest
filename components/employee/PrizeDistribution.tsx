// Prize distribution — REQUIRED step 2 after token scan.
// Cannot be dismissed without making a choice.
// Both step 1 (scan) and step 2 (distribution) are logged separately.
import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native'
import { GiftCardExtra } from './GiftCardExtra'
import type { RedemptionToken } from '../../types'

interface Props {
  token: RedemptionToken & { passport_pages?: { section_name: string; prize_description: string | null } }
  employeeAccountId: string
  onDistributed: () => void
  onRecordDistribution: (params: {
    prizeGiven: string
    isPending: boolean
    extraGiftCardCents?: number
    note?: string
  }) => Promise<boolean>
}

export function PrizeDistribution({ token, employeeAccountId, onDistributed, onRecordDistribution }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [giftCardAmount, setGiftCardAmount] = useState<number | null>(null)
  const [giftCardNote, setGiftCardNote] = useState('')

  const prizeDescription = (token as any).passport_pages?.prize_description ?? 'Prize'
  const sectionName = (token as any).passport_pages?.section_name ?? ''

  const handleGiven = useCallback(async () => {
    setSubmitting(true)
    const success = await onRecordDistribution({
      prizeGiven: prizeDescription,
      isPending: false,
      extraGiftCardCents: giftCardAmount ?? undefined,
      note: giftCardNote || undefined,
    })
    setSubmitting(false)
    if (success) onDistributed()
    else Alert.alert('Error', 'Could not record distribution. Please try again.')
  }, [prizeDescription, giftCardAmount, giftCardNote, onRecordDistribution, onDistributed])

  const handleManagerWillDistribute = useCallback(async () => {
    Alert.alert(
      'Manager will distribute',
      'This will flag the redemption as pending manager distribution. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true)
            await onRecordDistribution({
              prizeGiven: prizeDescription,
              isPending: true,
              note: 'Pending manager distribution',
            })
            setSubmitting(false)
            onDistributed()
          },
        },
      ]
    )
  }, [prizeDescription, onRecordDistribution, onDistributed])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.tokenCode}>{token.token_code}</Text>
        <Text style={styles.sectionName}>{sectionName} — Page Complete</Text>
      </View>

      <View style={styles.prizeCard}>
        <Text style={styles.prizeLabel}>PRIZE TO DISTRIBUTE</Text>
        <Text style={styles.prizeText}>{prizeDescription}</Text>
      </View>

      <GiftCardExtra
        value={giftCardAmount}
        note={giftCardNote}
        onAmountChange={setGiftCardAmount}
        onNoteChange={setGiftCardNote}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleGiven}
          style={[styles.givenBtn, submitting && styles.btnDisabled]}
          disabled={submitting}
        >
          <Text style={styles.givenBtnText}>{submitting ? 'Recording…' : 'Given ✓'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleManagerWillDistribute}
          style={[styles.pendingBtn, submitting && styles.btnDisabled]}
          disabled={submitting}
        >
          <Text style={styles.pendingBtnText}>Manager will distribute</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.auditNote}>
        Both token scan and prize distribution are logged separately for accountability.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  header: { marginBottom: 20 },
  tokenCode: {
    fontSize: 22,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#0D1B2A',
    letterSpacing: 2,
  },
  sectionName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  prizeCard: {
    backgroundColor: '#F5F0E8',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#C9A84C',
    marginBottom: 8,
  },
  prizeLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#C9A84C',
    fontWeight: '700',
    marginBottom: 6,
  },
  prizeText: {
    fontSize: 17,
    color: '#1a1a1a',
    fontFamily: 'serif',
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  givenBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  givenBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  pendingBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
  },
  pendingBtnText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.6 },
  auditNote: {
    marginTop: 24,
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    fontStyle: 'italic',
  },
})
