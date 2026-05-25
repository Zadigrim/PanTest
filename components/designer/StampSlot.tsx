// Draggable stamp slot for the designer pages canvas.
// States: empty (dashed border) · linked (shows stop name) · selected (gold corner handles).
// Uses react-native-gesture-handler Pan gesture to move; parent receives onMove callback.
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { palette } from '../../lib/colors'

const ACCENT   = palette.accent
const INK      = palette.ink
const MUTED    = palette.muted
const HAIRLINE = palette.hairline
const HANDLE   = 10

export interface SlotData {
  id: string
  stop_id: string | null
  stop_name: string | null
  pos_x: number   // percentage 0–100 of page width
  pos_y: number   // percentage 0–100 of page height
  width_pct: number
  height_pct: number
}

interface Props {
  slot: SlotData
  pageW: number
  pageH: number
  selected: boolean
  onSelect: () => void
  onMove: (id: string, posX: number, posY: number) => void
}

export function StampSlot({ slot, pageW, pageH, selected, onSelect, onMove }: Props) {
  const left   = (slot.pos_x   / 100) * pageW
  const top    = (slot.pos_y   / 100) * pageH
  const width  = (slot.width_pct  / 100) * pageW
  const height = (slot.height_pct / 100) * pageH

  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = dx.value
      startY.value = dy.value
    })
    .onUpdate(e => {
      dx.value = startX.value + e.translationX
      dy.value = startY.value + e.translationY
    })
    .onEnd(() => {
      const newPosX = Math.max(0, Math.min(100, slot.pos_x + (dx.value / pageW) * 100))
      const newPosY = Math.max(0, Math.min(100, slot.pos_y + (dy.value / pageH) * 100))
      runOnJS(onMove)(slot.id, newPosX, newPosY)
      dx.value = 0
      dy.value = 0
    })

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }],
  }))

  const isLinked = !!slot.stop_id

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          s.slot,
          { position: 'absolute', left, top, width, height },
          selected && s.slotSelected,
          animated,
        ]}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onSelect} activeOpacity={0.8}>
          <View style={[s.inner, isLinked ? s.innerLinked : s.innerEmpty]}>
            {isLinked
              ? <Text style={s.stopName} numberOfLines={2}>{slot.stop_name}</Text>
              : <Text style={s.emptyLabel}>stamp slot</Text>
            }
          </View>
        </TouchableOpacity>

        {/* Corner handles — only when selected */}
        {selected && (
          <>
            <View style={[s.handle, s.handleTL]} />
            <View style={[s.handle, s.handleTR]} />
            <View style={[s.handle, s.handleBL]} />
            <View style={[s.handle, s.handleBR]} />
            {/* Stop number badge */}
            {isLinked && (
              <View style={s.badge}>
                <Text style={s.badgeText}>●</Text>
              </View>
            )}
          </>
        )}
      </Animated.View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  slot: { position: 'absolute' },
  slotSelected: {
    zIndex: 10,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  innerEmpty: {
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(200,191,169,0.06)',
  },
  innerLinked: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  emptyLabel: { fontSize: 9, color: HAIRLINE, fontStyle: 'italic' },
  stopName: { fontSize: 10, color: INK, fontWeight: '600', textAlign: 'center', padding: 4 },
  handle: {
    position: 'absolute', width: HANDLE, height: HANDLE,
    backgroundColor: ACCENT, borderRadius: 1,
    borderWidth: 1, borderColor: INK,
  },
  handleTL: { top: -HANDLE / 2, left: -HANDLE / 2 },
  handleTR: { top: -HANDLE / 2, right: -HANDLE / 2 },
  handleBL: { bottom: -HANDLE / 2, left: -HANDLE / 2 },
  handleBR: { bottom: -HANDLE / 2, right: -HANDLE / 2 },
  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: ACCENT, borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 6, color: INK },
})
