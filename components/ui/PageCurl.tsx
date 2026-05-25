// Page curl shadow overlay — rendered beneath the curling page.
// The actual curl animation is driven by PassportBook.tsx via Reanimated.
import React from 'react'
import { StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'

interface Props {
  progress: SharedValue<number> // 0 = closed, 1 = fully open
  pageWidth: number
  pageHeight: number
}

export function PageCurlShadow({ progress, pageWidth, pageHeight }: Props) {
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.35,
  }))

  return (
    <Animated.View
      style={[styles.shadow, shadowStyle, { width: pageWidth, height: pageHeight }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
})
