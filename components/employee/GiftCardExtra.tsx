// Optional extra gift card — employee adds amount and note.
// Both are logged in the redemption_tokens audit record.
import React from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native'
import { palette } from '../../lib/colors'

const AMOUNTS = [5, 10, 15, 25]

interface Props {
  value: number | null
  note: string
  onAmountChange: (cents: number | null) => void
  onNoteChange: (note: string) => void
}

export function GiftCardExtra({ value, note, onAmountChange, onNoteChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Extra gift card (optional)</Text>

      <View style={styles.amountRow}>
        {AMOUNTS.map((dollars) => (
          <TouchableOpacity
            key={dollars}
            onPress={() => onAmountChange(value === dollars * 100 ? null : dollars * 100)}
            style={[styles.amountBtn, value === dollars * 100 && styles.amountBtnSelected]}
          >
            <Text style={[styles.amountText, value === dollars * 100 && styles.amountTextSelected]}>
              ${dollars}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {value != null && (
        <TextInput
          style={styles.noteInput}
          placeholder="Reason for extra gift card…"
          placeholderTextColor="#bbb"
          value={note}
          onChangeText={onNoteChange}
          multiline
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  amountBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  amountBtnSelected: {
    borderColor: palette.accent,
    backgroundColor: '#C9A84C20',
  },
  amountText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  amountTextSelected: {
    color: '#9A7A2A',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
    color: '#333',
    textAlignVertical: 'top',
  },
})
