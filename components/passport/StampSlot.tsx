// Stamp slot — the BASE layer within a location box: the dormant ghost
// impression and the ready/pressing preview. The EARNED ("stamped")
// stamp is intentionally NOT rendered here — it's drawn by
// DesignerLocationBox as a sibling AFTER the pre-printed name + caption
// so it lands on top, like ink stamped over a printed page.
import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import type { Stop, StampSlotState } from '../../types'
import { StampArtwork } from '../stamp/StampArtwork'
import { StampRing } from '../ui/Illustrations'

interface Props {
  stop: Stop
  state: StampSlotState
  width: number
  height: number
}

export function StampSlot({ stop, state, width, height }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current
  const pressAnim = useRef(new Animated.Value(1)).current

  // Gentle pulse when ready
  useEffect(() => {
    if (state === 'ready') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [state, pulseAnim])

  // Press scale
  useEffect(() => {
    if (state === 'pressing') {
      Animated.timing(pressAnim, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start()
    }
  }, [state, pressAnim])

  const isDormant = state === 'dormant'

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Dormant: the branded stamp ring (assets/ui/btn-stamp-ring.svg),
          tinted to this stop's stamp_color via currentColor. Replaces the
          old generic dashed rectangle. */}
      {isDormant && (
        <View style={styles.ghost}>
          <StampRing size={Math.min(width, height) * 0.78} color={stop.stamp_color} />
        </View>
      )}

      {/* Ready / pressing state: stamp icon preview */}
      {(state === 'ready' || state === 'pressing') && (
        <Animated.View
          style={{
            transform: [
              { scale: Animated.multiply(pulseAnim, pressAnim) },
            ],
            opacity: state === 'pressing' ? 0.9 : 1,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <StampArtwork stop={stop} size={Math.min(width, height) * 0.7} ghost />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
