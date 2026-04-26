// Ink ripple animation played when a stamp is placed.
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

interface Props {
  color: string
  size: number
  onComplete?: () => void
}

export function InkRipple({ color, size, onComplete }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current
  const opacity = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 2.5, duration: 600, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onComplete?.()
    })
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    borderWidth: 2,
  },
})
