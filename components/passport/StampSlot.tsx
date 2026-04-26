// Stamp slot — the bounding box within a location box.
// States: dormant (ghost), ready (pulsing), pressing (scale down), stamped.
import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import type { Stop, Stamp, StampSlotState } from '../../types'
import { StampArtwork } from '../stamp/StampArtwork'

interface Props {
  stop: Stop
  state: StampSlotState
  stamp?: Stamp | null
  width: number
  height: number
}

export function StampSlot({ stop, state, stamp, width, height }: Props) {
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
  const isStamped = state === 'stamped'

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Ghost impression for dormant state */}
      {isDormant && (
        <View style={styles.ghost}>
          <View style={[styles.ghostBorder, { borderColor: stop.stamp_color + '60' }]} />
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

      {/* Stamped state */}
      {isStamped && stamp && (
        <View
          style={[
            styles.stampedContainer,
            {
              left: `${stamp.stamp_pos_x ?? 50}%` as any,
              top: `${stamp.stamp_pos_y ?? 50}%` as any,
              transform: [{ translateX: -Math.min(width, height) * 0.35 }, { translateY: -Math.min(width, height) * 0.35 }],
            },
          ]}
        >
          <StampArtwork
            stop={stop}
            size={Math.min(width, height) * 0.7}
            rotationDeg={stamp.rotation_deg}
            smudge={stop.stamp_smudge}
          />
        </View>
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
  ghostBorder: {
    width: '70%',
    height: '70%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    opacity: 0.5,
  },
  stampedContainer: {
    position: 'absolute',
  },
})
