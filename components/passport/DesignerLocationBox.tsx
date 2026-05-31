// Absolutely-positioned stamp box that mirrors the designer's location box placement.
// Uses measure() for absolute screen coords so StampGestureInteraction works correctly.
import React, { useRef, useCallback } from 'react'
import { View, LayoutRectangle } from 'react-native'
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
