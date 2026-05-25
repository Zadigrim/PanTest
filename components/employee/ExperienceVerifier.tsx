// Employee experience stamp verification screen.
// Shows stop name, verification type, and a large verify button.
// Warns prominently when this is the final stop completing a page.
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native'
import type { Stop } from '../../types'
import { palette } from '../../lib/colors'

interface Props {
  stop: Stop
  isPageCompletingStop: boolean
  onVerify: (note?: string) => Promise<void>
}

export function ExperienceVerifier({ stop, isPageCompletingStop, onVerify }: Props) {
  const [note, setNote] = useState('')
  const [verifying, setVerifying] = useState(false)

  const handleVerify = async () => {
    setVerifying(true)
    await onVerify(note || undefined)
    setVerifying(false)
  }

  const verificationLabels: Record<string, string> = {
    witnessed: 'Witnessed by employee',
    documented: 'Documentation reviewed',
    presence: 'Physical presence confirmed',
    honor: 'Honor system',
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stopName}>{stop.name}</Text>
      <Text style={styles.verificationType}>
        {verificationLabels[stop.verification_type ?? 'presence']}
      </Text>

      {isPageCompletingStop && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠</Text>
          <Text style={styles.warningText}>
            This completes the page — you will need to distribute a prize next.
          </Text>
        </View>
      )}

      <TextInput
        style={styles.noteInput}
        placeholder="Optional note…"
        placeholderTextColor="#bbb"
        value={note}
        onChangeText={setNote}
        multiline
      />

      <TouchableOpacity
        onPress={handleVerify}
        style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
        disabled={verifying}
      >
        <Text style={styles.verifyBtnText}>
          {verifying ? 'Verifying…' : '✓  Verify this experience'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  stopName: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.navy,
    marginBottom: 4,
    fontFamily: 'serif',
  },
  verificationType: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    gap: 8,
  },
  warningIcon: {
    fontSize: 18,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#7D4A00',
    fontWeight: '600',
    lineHeight: 20,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    color: '#333',
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  verifyBtn: {
    backgroundColor: palette.green,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
