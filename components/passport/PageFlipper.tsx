// Left-edge hinge page-flip using Reanimated rotateY.
// Front face (current page) rotates from 0 → +180 to reveal destination beneath.
// backfaceVisibility='hidden' hides the rotated face; destination sits statically below.
// Exposes goTo(index) imperatively via ref for Cover → first page and TOC navigation.
import React, {
  useState, useCallback, useRef, forwardRef, useImperativeHandle,
} from 'react'
import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { usePageDimensions } from './PassportFrame'

export interface PageFlipperHandle {
  goTo: (index: number) => void
}

interface Props {
  pages: React.ReactNode[]
  initialIndex?: number
  onPageChange?: (index: number) => void
}

const FLIP_DURATION = 370

export const PageFlipper = forwardRef<PageFlipperHandle, Props>(function PageFlipper(
  { pages, initialIndex = 0, onPageChange },
  ref,
) {
  const { pageW, pageH } = usePageDimensions()
  const halfW = pageW / 2

  const [currentIdx, setCurrentIdx] = useState(initialIndex)
  const [nextIdx, setNextIdx] = useState<number | null>(null)
  const flipping = useRef(false)
  const flipAngle = useSharedValue(0)

  const completeFlip = useCallback((toIdx: number) => {
    setCurrentIdx(toIdx)
    setNextIdx(null)
    flipAngle.value = 0
    flipping.current = false
    onPageChange?.(toIdx)
  }, [flipAngle, onPageChange])

  const triggerFlip = useCallback((dir: 'forward' | 'backward') => {
    if (flipping.current) return
    const canForward = currentIdx < pages.length - 1
    const canBackward = currentIdx > 0
    if (dir === 'forward' && !canForward) return
    if (dir === 'backward' && !canBackward) return

    const to = dir === 'forward' ? currentIdx + 1 : currentIdx - 1
    flipping.current = true
    setNextIdx(to)

    const targetAngle = dir === 'forward' ? 180 : -180
    flipAngle.value = withTiming(targetAngle, { duration: FLIP_DURATION }, (done) => {
      if (done) runOnJS(completeFlip)(to)
    })
  }, [currentIdx, pages.length, flipAngle, completeFlip])

  // Imperative handle — allows parent to jump directly to a page without animation.
  useImperativeHandle(ref, () => ({
    goTo(index: number) {
      if (flipping.current) return
      const clamped = Math.max(0, Math.min(index, pages.length - 1))
      flipAngle.value = 0
      setNextIdx(null)
      setCurrentIdx(clamped)
      onPageChange?.(clamped)
    },
  }), [flipAngle, pages.length, onPageChange])

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -40) runOnJS(triggerFlip)('forward')
      else if (e.translationX > 40) runOnJS(triggerFlip)('backward')
    })

  // Left-edge hinge: [{translateX: -halfW}, {rotateY: deg}, {translateX: halfW}]
  // keeps the left edge fixed; right edge sweeps forward when deg → 180.
  const frontStyle = useAnimatedStyle(() => {
    const deg = flipAngle.value
    return {
      transform: [
        { perspective: 1200 },
        { translateX: -halfW },
        { rotateY: `${deg}deg` },
        { translateX: halfW },
      ],
    }
  })

  const handleTap = useCallback((x: number) => {
    if (x > pageW * 0.68) triggerFlip('forward')
    else if (x < pageW * 0.32) triggerFlip('backward')
  }, [pageW, triggerFlip])

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ width: pageW, height: pageH }}>
        {/* Destination page sits statically beneath */}
        {nextIdx !== null && (
          <View
            style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
            pointerEvents="none"
          >
            {pages[nextIdx]}
          </View>
        )}

        {/* Current page on top — animates away */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 1, backfaceVisibility: 'hidden' },
            frontStyle,
          ]}
        >
          <TouchableWithoutFeedback
            onPress={(e) => handleTap(e.nativeEvent.locationX)}
          >
            <View style={{ flex: 1 }}>{pages[currentIdx]}</View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </GestureDetector>
  )
})
