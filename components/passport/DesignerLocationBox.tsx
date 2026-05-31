// Absolutely-positioned stamp box that mirrors the designer's location box placement.
// Uses measure() for absolute screen coords so StampGestureInteraction works correctly.
import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, LayoutRectangle } from 'react-native'
import { StampSlot } from './StampSlot'
import { StampGestureInteraction } from '../stamp/StampGestureInteraction'
import type { Stop, Stamp, StampSlotState, StampPlacement } from '../../types'

interface Props {
  stop: Stop
  scale: number
  slotState: StampSlotState
  stamp?: Stamp | null
  onStampPlaced: (placement: StampPlacement) => void
  onPressStart: () => void
  onPressCancel: () => void
}

export function DesignerLocationBox({
  stop,
  scale,
  slotState,
  stamp,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  const [boxLayout, setBoxLayout] = React.useState<LayoutRectangle>({ x: 0, y: 0, width: 0, height: 0 })
  const boxRef = useRef<View>(null)

  const onLayout = useCallback(() => {
    boxRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setBoxLayout({ x: pageX, y: pageY, width, height })
    })
  }, [])

  const rotation = stop.rotation ?? 0
  const boxX = (stop.box_x ?? 0) * scale
  const boxY = (stop.box_y ?? 0) * scale
  const boxW = stop.box_width * scale
  const boxH = stop.box_height * scale

  return (
    <View
      ref={boxRef}
      style={{
        position: 'absolute',
        left: boxX,
        top: boxY,
        width: boxW,
        height: boxH,
        transform: rotation ? [{ rotate: `${rotation}deg` }] : undefined,
      }}
      onLayout={onLayout}
    >
      <StampSlot stop={stop} state={slotState} stamp={stamp} width={boxW} height={boxH} />

      {/* Pre-printed label content: stop name + year. Sits on the
          LocationBox the way the web designer's preview shows
          stamp_icon + name. Centered at the top of the box, scaled
          with the artboard. pointerEvents=none so it doesn't intercept
          the gesture. Suppressed entirely when the box is very small
          (under ~70px wide) — the label would be unreadable. */}
      {boxW >= 70 && (
        <View
          pointerEvents="none"
          style={[styles.labelContainer, { top: 4 * scale, paddingHorizontal: 6 * scale }]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.labelName,
              {
                fontSize: Math.max(9, 11 * scale),
                color: `#${stop.stamp_color ?? '0D1B2A'}`,
              },
            ]}
          >
            {stop.name}
          </Text>
          {stop.year_established && boxH >= 90 && (
            <Text
              numberOfLines={1}
              style={[styles.labelYear, { fontSize: Math.max(7, 9 * scale) }]}
            >
              Est. {stop.year_established}
            </Text>
          )}
        </View>
      )}

      {(slotState === 'ready' || slotState === 'pressing') && boxLayout.width > 0 && (
        <StampGestureInteraction
          stop={stop}
          slotState={slotState}
          boxLayout={boxLayout}
          onPressStart={onPressStart}
          onPressCancel={onPressCancel}
          onStampPlaced={onStampPlaced}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelName: {
    fontFamily: 'serif',
    fontWeight: '600',
    textAlign: 'center',
  },
  labelYear: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
})
