// Stamp slot — the BASE layer within a location box: the where-to-stamp
// guide for un-earned slots. The EARNED ("stamped") stamp is intentionally
// NOT rendered here — it's drawn by DesignerLocationBox as a sibling AFTER
// the pre-printed name + caption so it lands on top, like ink stamped over
// a printed page.
//
// What the guide looks like is a personal reader preference
// (ViewerPrefsContext.stampGuide):
//   'off'  → nothing — the passport reads clean, as designed
//   'ring' → the branded stamp ring, tinted to the stop's stamp_color
//   'box'  → a dashed bounding box outlining the slot
import React, { useContext, useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import type { Stop, StampSlotState } from '../../types'
import { StampRing } from '../ui/Illustrations'
import { ViewerPrefsContext } from '../../lib/viewer-prefs'

interface Props {
  stop: Stop
  state: StampSlotState
  width: number
  height: number
}

export function StampSlot({ stop, state, width, height }: Props) {
  const { stampGuide } = useContext(ViewerPrefsContext)
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
      Animated.timing(pressAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }).start()
    } else {
      Animated.timing(pressAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start()
    }
  }, [state, pressAnim])

  // Earned slots paint nothing here (the stamp is a sibling), and the
  // "off" preference hides the guide entirely for the clean designed look.
  // The gesture layer (DesignerLocationBox) is independent, so collectors
  // can still stamp with the guide off.
  if (state === 'stamped' || stampGuide === 'off') {
    return <View style={[styles.container, { width, height }]} />
  }

  const guide =
    stampGuide === 'box' ? (
      <View style={[styles.boxGuide, { borderColor: stop.stamp_color + '66' }]} />
    ) : (
      <StampRing size={Math.min(width, height) * 0.78} color={stop.stamp_color} />
    )

  return (
    <View style={[styles.container, { width, height }]}>
      <Animated.View
        style={[
          styles.guideWrap,
          {
            transform: [{ scale: Animated.multiply(pulseAnim, pressAnim) }],
            opacity: state === 'pressing' ? 0.9 : 1,
          },
        ]}
      >
        {guide}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxGuide: {
    width: '94%',
    height: '94%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 6,
  },
})
