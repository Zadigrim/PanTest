// Absolutely-positioned stamp box that mirrors the designer's location box placement.
// Uses measure() for absolute screen coords so StampGestureInteraction works correctly.
import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, LayoutRectangle } from 'react-native'
import { StampSlot } from './StampSlot'
import { StampArtwork } from '../stamp/StampArtwork'
import { StampGestureInteraction } from '../stamp/StampGestureInteraction'
import type { Stop, Stamp, StampSlotState, StampPlacement } from '../../types'
import { locationCaptionText } from '../../lib/location-caption'

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

  // Optional location caption (migration 079) — single-source formatter
  // shared with kobo + print. Null when off or when the chosen mode has
  // no data. Renders in the BASE layer (under the earned stamp).
  const caption = locationCaptionText(stop.location_caption_mode, stop)
  const captionPlacement = stop.location_caption_placement ?? 'interior'
  const captionFontSize = Math.max(7, 8 * scale)

  // Earned stamp, extracted so it paints AFTER the name + caption —
  // the load-bearing z-order rule: the stamp is ink over a printed page,
  // so it is the topmost layer. Mutually exclusive with the gesture
  // overlay (ready/pressing), so paint order between them is moot.
  const placedStamp =
    slotState === 'stamped' && stamp
      ? (() => {
          const stampSize = stamp.contact_size_px ?? Math.min(boxW, boxH) * 0.7
          return (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${stamp.stamp_pos_x ?? 50}%`,
                top: `${stamp.stamp_pos_y ?? 50}%`,
                transform: [{ translateX: -stampSize / 2 }, { translateY: -stampSize / 2 }],
              }}
            >
              <StampArtwork
                stop={stop}
                size={stampSize}
                rotationDeg={stamp.rotation_deg}
                saturation={stamp.saturation}
                smudgeDx={stamp.smudge_dx}
                smudgeDy={stamp.smudge_dy}
                smudgeIntensity={stamp.smudge_intensity}
                tiltDx={stamp.tilt_dx}
                tiltDy={stamp.tilt_dy}
                tiltIntensity={stamp.tilt_intensity}
                earnedAt={stamp.verified_at}
              />
            </View>
          )
        })()
      : null

  return (
    <>
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
        {/* Base layer: ghost / ready preview. */}
        <StampSlot stop={stop} state={slotState} width={boxW} height={boxH} />

        {/* Base layer: pre-printed name + year. Centered at the top of
            the box, scaled with the artboard. pointerEvents=none so it
            doesn't intercept the gesture. Suppressed when the box is very
            small (under ~70px wide) — the label would be unreadable. */}
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

        {/* Base layer: interior-lower caption. */}
        {caption && captionPlacement === 'interior' && boxW >= 70 && (
          <View
            pointerEvents="none"
            style={[styles.captionContainer, { bottom: 3 * scale, paddingHorizontal: 6 * scale }]}
          >
            <Text numberOfLines={1} style={[styles.caption, { fontSize: captionFontSize }]}>
              {caption}
            </Text>
          </View>
        )}

        {/* TOP layer: the earned stamp — ink over the printed page. */}
        {placedStamp}

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

      {/* Exterior caption — sits just below the box (own absolute sibling
          so it isn't clipped by the box and tracks the box origin). */}
      {caption && captionPlacement === 'exterior' && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: boxX, top: boxY + boxH + 2 * scale, width: boxW, alignItems: 'center' }}
        >
          <Text numberOfLines={1} style={[styles.caption, { fontSize: captionFontSize }]}>
            {caption}
          </Text>
        </View>
      )}
    </>
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
  captionContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  caption: {
    color: '#555555',
    textAlign: 'center',
  },
})
