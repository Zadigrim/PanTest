// Stamping overlay — dims the page, shows "YOU ARE AT <name>", press-and-hold circular target.
// Holds for 1.5s; emits onStamp on success. Dismisses on tap outside.
import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import type { Stop } from '../../types'
import { palette } from '../../lib/colors'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  stop: Stop
  onStamp: () => void
  onCancel: () => void
}

const HOLD_DURATION = 1500
const R = 46          // ring radius
const STROKE = 5
const DIAMETER = (R + STROKE) * 2
const CIRCUMFERENCE = 2 * Math.PI * R

const INK = palette.ink
const GOLD = palette.accent

export function StampingOverlay({ stop, onStamp, onCancel }: Props) {
  const progress = useSharedValue(0)

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onStamp()
  }, [onStamp])

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + 0.08 * progress.value }],
  }))

  const startHold = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    progress.value = withTiming(1, { duration: HOLD_DURATION }, (done) => {
      if (done) runOnJS(handleComplete)()
    })
  }, [progress, handleComplete])

  const cancelHold = useCallback(() => {
    cancelAnimation(progress)
    progress.value = withTiming(0, { duration: 200 })
  }, [progress])

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      {/* Tap outside to cancel */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable stops propagation so card taps don't dismiss */}
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.youAreAt}>YOU ARE AT</Text>
          <Text style={styles.stopName}>{stop.name}</Text>
          {stop.location_name ? (
            <Text style={styles.locationName}>{stop.location_name}</Text>
          ) : null}

          {/* Press-and-hold ring target */}
          <Animated.View style={[styles.holdArea, scaleStyle]}>
            <Svg width={DIAMETER} height={DIAMETER}>
              {/* Track ring */}
              <Circle
                cx={DIAMETER / 2}
                cy={DIAMETER / 2}
                r={R}
                stroke={`${INK}18`}
                strokeWidth={STROKE}
                fill="none"
              />
              {/* Progress ring — starts at top (-90 deg rotation) */}
              <AnimatedCircle
                cx={DIAMETER / 2}
                cy={DIAMETER / 2}
                r={R}
                stroke={GOLD}
                strokeWidth={STROKE}
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={animatedRingProps}
                fill="none"
                strokeLinecap="round"
                rotation={-90}
                origin={`${DIAMETER / 2}, ${DIAMETER / 2}`}
              />
            </Svg>

            {/* Center content — layered on top of SVG */}
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.holdLabel}>HOLD</Text>
              <Text style={styles.holdIcon}>{stop.stamp_icon ?? '✦'}</Text>
            </View>

            {/* Touch target over the ring */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPressIn={startHold}
              onPressOut={cancelHold}
            />
          </Animated.View>

          <Text style={styles.holdHint}>Press and hold to stamp</Text>

          <Pressable style={styles.cancelBtn} onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,12,6,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 4,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    width: 280,
    borderWidth: 1.5,
    borderColor: `${GOLD}55`,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  youAreAt: {
    fontSize: 9,
    letterSpacing: 4,
    color: `${INK}66`,
    fontWeight: '700',
    marginBottom: 6,
  },
  stopName: {
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 26,
  },
  locationName: {
    fontSize: 11,
    color: `${INK}55`,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  holdArea: {
    width: DIAMETER,
    height: DIAMETER,
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  holdLabel: {
    fontSize: 8,
    letterSpacing: 3,
    color: `${INK}66`,
    fontWeight: '700',
    marginBottom: 4,
  },
  holdIcon: {
    fontSize: 26,
  },
  holdHint: {
    fontSize: 10,
    color: `${INK}55`,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 11,
    color: `${INK}55`,
    letterSpacing: 1,
  },
})
