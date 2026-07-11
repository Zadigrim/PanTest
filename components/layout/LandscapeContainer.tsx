import React from 'react'
import { View, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native'

// Centers single-column content in a max-width column when the viewport is
// wider than the content needs (landscape tablets, and wide portrait tablets),
// so screens don't stretch edge-to-edge. On phones (width <= maxWidth) it's a
// no-op passthrough — behavior is byte-identical to before, satisfying the
// "phones unchanged" guard.
export function LandscapeContainer({
  children,
  maxWidth = 640,
  style,
}: {
  children: React.ReactNode
  maxWidth?: number
  style?: ViewStyle
}) {
  const { width } = useWindowDimensions()
  if (width <= maxWidth) return <>{children}</>
  return (
    <View style={styles.center}>
      <View style={[styles.inner, { maxWidth }, style]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%' },
})
