// Page-turning passport book with page curl animation.
// Direction: right-to-left = forward, left-to-right = backward.
// Curl reveals the next page beneath with a shadow.
import React, { useRef, useState, useCallback } from 'react'
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { PassportCover } from './PassportCover'
import { PassportPage } from './PassportPage'
import type { Passport, PassportPage as PassportPageType, Stop, Stamp, StampSlotState, StampPlacement } from '../../types'

interface Props {
  passport: Passport
  pages: PassportPageType[]
  stops: Record<string, Stop[]>
  stamps: Record<string, Record<string, Stamp>>
  slotStates: Record<string, Record<string, StampSlotState>>
  onStampPlaced: (pageId: string, stopId: string, placement: StampPlacement) => void
  onPressStart: (pageId: string, stopId: string) => void
  onPressCancel: (pageId: string, stopId: string) => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PAGE_W = SCREEN_WIDTH
const PAGE_H = SCREEN_HEIGHT - 120

export function PassportBook({
  passport,
  pages,
  stops,
  stamps,
  slotStates,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  // 0 = cover, 1..N = pages
  const [currentIndex, setCurrentIndex] = useState(0)
  const totalPages = pages.length + 1 // +1 for cover

  const translateX = useSharedValue(0)
  const curlProgress = useSharedValue(0)

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalPages - 1))
    setCurrentIndex(clamped)
    translateX.value = 0
    curlProgress.value = 0
  }, [totalPages, translateX, curlProgress])

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX
      curlProgress.value = Math.abs(e.translationX) / PAGE_W
    })
    .onEnd((e) => {
      const threshold = PAGE_W * 0.5
      if (e.translationX < -threshold && currentIndex < totalPages - 1) {
        translateX.value = withTiming(-PAGE_W, { duration: 280 })
        curlProgress.value = withTiming(0, { duration: 280 })
        runOnJS(goTo)(currentIndex + 1)
      } else if (e.translationX > threshold && currentIndex > 0) {
        translateX.value = withTiming(PAGE_W, { duration: 280 })
        curlProgress.value = withTiming(0, { duration: 280 })
        runOnJS(goTo)(currentIndex - 1)
      } else {
        translateX.value = withSpring(0)
        curlProgress.value = withTiming(0)
      }
    })

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  function renderPage(index: number) {
    if (index === 0) {
      return (
        <PassportCover passport={passport} width={PAGE_W} height={PAGE_H} />
      )
    }
    const page = pages[index - 1]
    if (!page) return null
    const pageStops = stops[page.id] ?? []
    const pageStamps = stamps[page.id] ?? {}
    const pageSlotStates = slotStates[page.id] ?? {}

    return (
      <PassportPage
        passport={passport}
        page={page}
        stops={pageStops}
        stamps={pageStamps}
        slotStates={pageSlotStates}
        width={PAGE_W}
        height={PAGE_H}
        onStampPlaced={(stopId, placement) => onStampPlaced(page.id, stopId, placement)}
        onPressStart={(stopId) => onPressStart(page.id, stopId)}
        onPressCancel={(stopId) => onPressCancel(page.id, stopId)}
      />
    )
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.bookContainer, pageStyle]}>
          {renderPage(currentIndex)}
        </Animated.View>
      </GestureDetector>

      {/* Navigation arrows */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {currentIndex === 0 ? 'Cover' : `${currentIndex} / ${pages.length}`}
        </Text>

        <TouchableOpacity
          onPress={() => goTo(currentIndex + 1)}
          disabled={currentIndex === totalPages - 1}
          style={[styles.navBtn, currentIndex === totalPages - 1 && styles.navBtnDisabled]}
        >
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  bookContainer: {
    flex: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#111',
  },
  navBtn: {
    padding: 8,
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  navArrow: {
    fontSize: 28,
    color: '#C9A84C',
    fontFamily: 'serif',
  },
  pageIndicator: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
})
