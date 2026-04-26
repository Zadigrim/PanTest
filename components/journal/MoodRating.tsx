import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

const MOODS = [
  { value: 1, emoji: '😕', label: 'Meh' },
  { value: 2, emoji: '🙂', label: 'Okay' },
  { value: 3, emoji: '😊', label: 'Good' },
  { value: 4, emoji: '😄', label: 'Great' },
  { value: 5, emoji: '🤩', label: 'Epic' },
]

interface Props {
  value: number | null
  onChange: (rating: number) => void
}

export function MoodRating({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How was it?</Text>
      <View style={styles.row}>
        {MOODS.map((mood) => (
          <TouchableOpacity
            key={mood.value}
            onPress={() => onChange(mood.value)}
            style={[styles.moodBtn, value === mood.value && styles.moodBtnSelected]}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text style={[styles.moodLabel, value === mood.value && styles.moodLabelSelected]}>
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodBtn: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 52,
  },
  moodBtnSelected: {
    borderColor: '#C9A84C',
    backgroundColor: '#C9A84C15',
  },
  emoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  moodLabel: {
    fontSize: 10,
    color: '#888',
  },
  moodLabelSelected: {
    color: '#C9A84C',
    fontWeight: '600',
  },
})
