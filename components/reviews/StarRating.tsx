// 1-5 star rating, used both as an input (interactive) and a static display.
// Uses ★/☆ typographic glyphs (consistent with the existing ★/✓ chrome) and
// palette tokens — no emoji, no inline hex.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { palette } from '../../lib/colors'

interface Props {
  value: number            // 0-5; fractional values round for display
  onChange?: (value: number) => void // omit for a read-only display
  size?: number
}

const STARS = [1, 2, 3, 4, 5]

export function StarRating({ value, onChange, size = 28 }: Props) {
  const readOnly = !onChange
  const rounded = Math.round(value)

  return (
    <View style={styles.row}>
      {STARS.map((n) => {
        const filled = n <= rounded
        const glyph = (
          <Text style={{ fontSize: size, color: filled ? palette.accent : palette.hairline }}>
            {filled ? '★' : '☆'}
          </Text>
        )
        if (readOnly) return <View key={n}>{glyph}</View>
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange?.(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          >
            {glyph}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
})
