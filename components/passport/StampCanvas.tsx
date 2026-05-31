// Canvas that renders all earned stamps on a page — stamp edges may bleed freely.
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { StampArtwork } from '../stamp/StampArtwork'
import type { Stop, Stamp } from '../../types'

interface Props {
  stops: Stop[]
  stamps: Record<string, Stamp>
  canvasWidth: number
  canvasHeight: number
}

export function StampCanvas({ stops, stamps, canvasWidth, canvasHeight }: Props) {
  return (
    <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]} pointerEvents="none">
      {stops.map((stop) => {
        const stamp = stamps[stop.id]
        if (!stamp || stamp.stamp_pos_x == null || stamp.stamp_pos_y == null) return null

        const stampSize = (stamp.contact_size_px ?? 60) * 1.1
        const x = (stamp.stamp_pos_x / 100) * canvasWidth - stampSize / 2
        const y = (stamp.stamp_pos_y / 100) * canvasHeight - stampSize / 2

        // Pass through the gesture-derived appearance fields when set
        // (migration 040). StampArtwork falls back to the legacy
        // discrete stop.stamp_smudge enum when all four are null —
        // ensuring pre-040 stamps render exactly as before.
        return (
          <View
            key={stop.id}
            style={[styles.stampWrapper, { left: x, top: y }]}
          >
            <StampArtwork
              stop={stop}
              size={stampSize}
              rotationDeg={stamp.rotation_deg}
              saturation={stamp.saturation}
              smudgeDx={stamp.smudge_dx}
              smudgeDy={stamp.smudge_dy}
              smudgeIntensity={stamp.smudge_intensity}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  stampWrapper: {
    position: 'absolute',
    overflow: 'visible',
  },
})
