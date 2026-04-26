// Core stamp press interaction — the fundamental mechanic.
// PATENT-RELEVANT: stamp center must be within the location box bounding area.
// Stamp edges extend freely past the box boundary with NO clipping.
import React, { useRef, useState, useCallback } from 'react'
import { View, StyleSheet, PanResponder, LayoutRectangle } from 'react-native'
import { InkRipple } from './InkRipple'
import { StampArtwork } from './StampArtwork'
import type { Stop, StampSlotState, StampPlacement } from '../../types'
import { computeStampPlacement } from '../../lib/stamp'

interface Props {
  stop: Stop
  slotState: StampSlotState
  boxLayout: LayoutRectangle          // measured bounding box of the location box
  onPressStart: () => void
  onPressCancel: () => void
  onStampPlaced: (placement: StampPlacement) => void
}

export function StampPressInteraction({
  stop,
  slotState,
  boxLayout,
  onPressStart,
  onPressCancel,
  onStampPlaced,
}: Props) {
  const [rippleKey, setRippleKey] = useState(0)
  const [showRipple, setShowRipple] = useState(false)
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 })
  const pressStartTime = useRef<number>(0)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => slotState === 'ready',
      onPanResponderGrant: (evt) => {
        if (slotState !== 'ready') return
        pressStartTime.current = Date.now()
        onPressStart()
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (slotState !== 'pressing') return

        const { pageX, pageY } = evt.nativeEvent
        const contactRadius = (evt.nativeEvent as any).radiusX ?? 22

        const placement = computeStampPlacement(
          pageX,
          pageY,
          boxLayout.x,
          boxLayout.y,
          boxLayout.width,
          boxLayout.height,
          contactRadius,
          stop
        )

        if (!placement) {
          // Center was outside the box — silent no-op
          onPressCancel()
          return
        }

        // Show ink ripple at touch point
        setRipplePos({ x: pageX - boxLayout.x, y: pageY - boxLayout.y })
        setRippleKey((k) => k + 1)
        setShowRipple(true)

        onStampPlaced(placement)
      },
      onPanResponderTerminate: () => {
        onPressCancel()
      },
    })
  ).current

  return (
    <View
      style={[styles.container, { width: boxLayout.width, height: boxLayout.height }]}
      {...panResponder.panHandlers}
    >
      {showRipple && (
        <View
          key={rippleKey}
          style={[styles.rippleContainer, { left: ripplePos.x, top: ripplePos.y }]}
          pointerEvents="none"
        >
          <InkRipple
            color={stop.stamp_color}
            size={60}
            onComplete={() => setShowRipple(false)}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  rippleContainer: {
    position: 'absolute',
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
})
