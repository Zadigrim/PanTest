// Location box — bounding box for stamp placement + pre-printed content.
// The box IS the stamp bounding area; stamp center must fall within it.
import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, LayoutRectangle } from 'react-native'
import { StampSlot } from './StampSlot'
import { StampGestureInteraction } from '../stamp/StampGestureInteraction'
import type { Stop, Stamp, StampSlotState, StampPlacement } from '../../types'

interface Props {
  stop: Stop
  slotState: StampSlotState
  stamp?: Stamp | null
  onStampPlaced: (placement: StampPlacement) => void
  onPressStart: () => void
  onPressCancel: () => void
}

export function LocationBox({
  stop,
  slotState,
  stamp,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  const [boxLayout, setBoxLayout] = React.useState<LayoutRectangle>({
    x: 0, y: 0, width: 0, height: 0,
  })
  const boxRef = useRef<View>(null)

  const onLayout = useCallback(() => {
    boxRef.current?.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      setBoxLayout({ x: pageX, y: pageY, width, height })
    })
  }, [])

  return (
    <View ref={boxRef} style={styles.container} onLayout={onLayout}>
      {/* Pre-printed location text */}
      <View style={styles.header}>
        <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
        {stop.year_established && (
          <Text style={styles.year}>Est. {stop.year_established}</Text>
        )}
      </View>

      {stop.location_name && (
        <Text style={styles.locationName}>{stop.location_name}</Text>
      )}

      {/* Stamp area */}
      <View style={styles.stampArea}>
        <StampSlot
          stop={stop}
          state={slotState}
          stamp={stamp}
          width={boxLayout.width || 120}
          height={boxLayout.height ? boxLayout.height * 0.6 : 80}
        />

        {/* Expressive gesture: press-and-hold for size/saturation,
            initial drift sets rotation, total movement renders as
            directional smudge. Replaces the legacy StampPressInteraction
            (which remains in components/stamp/ as the deferred-future
            Path-A target for native contact-geometry reads). */}
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

      {stop.description && (
        <Text style={styles.description} numberOfLines={2}>{stop.description}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#C9A84C40',
    borderRadius: 4,
    padding: 8,
    marginVertical: 6,
    minHeight: 140,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  stopName: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  year: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  locationName: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  stampArea: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  description: {
    fontSize: 9,
    color: '#555',
    marginTop: 4,
    fontStyle: 'italic',
  },
})
