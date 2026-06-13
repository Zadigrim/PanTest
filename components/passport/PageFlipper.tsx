// Page-flip + pinch-to-zoom.
//
// Flip direction (BLD fix): the current page is always on top and animates
// away to reveal the destination beneath. The HINGE depends on direction so
// the motion matches the swipe:
//   • forward  (swipe left):  left-edge hinge, 0 → +180  → page turns LEFT.
//   • backward (swipe right): right-edge hinge, 0 → −180 → page turns RIGHT.
// (Previously both used the left-edge hinge, so swiping right animated as if
// turning left.)
//
// Zoom: a Pinch gesture (1–3×) runs simultaneously with the swipe Pan;
// paging is suppressed while zoomed (scale > ~1) so the two don't fight —
// pinch back to 1× to page again.
import React, {
  useState, useCallback, useRef, forwardRef, useImperativeHandle,
} from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { usePageDimensions } from './PassportFrame'

export interface PageFlipperHandle {
  goTo: (index: number) => void
  next: () => void
  prev: () => void
}

interface Props {
  pages: React.ReactNode[]
  initialIndex?: number
  onPageChange?: (index: number) => void
}

const FLIP_DURATION = 370
const MAX_ZOOM = 3

export const PageFlipper = forwardRef<PageFlipperHandle, Props>(function PageFlipper(
  { pages, initialIndex = 0, onPageChange },
  ref,
) {
  const { pageW, pageH } = usePageDimensions()
  const halfW = pageW / 2

  const [currentIdx, setCurrentIdx] = useState(initialIndex)
  const [nextIdx, setNextIdx] = useState<number | null>(null)
  const [flipDir, setFlipDir] = useState<'forward' | 'backward' | null>(null)
  const flipping = useRef(false)
  const flipAngle = useSharedValue(0)

  // Pinch zoom.
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)

  const completeFlip = useCallback((toIdx: number) => {
    setCurrentIdx(toIdx)
    setNextIdx(null)
    setFlipDir(null)
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
    setFlipDir(dir)

    const targetAngle = dir === 'forward' ? 180 : -180
    flipAngle.value = withTiming(targetAngle, { duration: FLIP_DURATION }, (done) => {
      if (done) runOnJS(completeFlip)(to)
    })
  }, [currentIdx, pages.length, flipAngle, completeFlip])

  useImperativeHandle(ref, () => ({
    goTo(index: number) {
      if (flipping.current) return
      const clamped = Math.max(0, Math.min(index, pages.length - 1))
      flipAngle.value = 0
      setNextIdx(null)
      setFlipDir(null)
      setCurrentIdx(clamped)
      onPageChange?.(clamped)
    },
    next() { triggerFlip('forward') },
    prev() { triggerFlip('backward') },
  }), [flipAngle, pages.length, onPageChange, triggerFlip])

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet'
      if (scale.value > 1.05) return // zoomed in — don't turn pages
      if (e.translationX < -40) runOnJS(triggerFlip)('forward')
      else if (e.translationX > 40) runOnJS(triggerFlip)('backward')
    })

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet'
      const next = savedScale.value * e.scale
      scale.value = next < 1 ? 1 : next > MAX_ZOOM ? MAX_ZOOM : next
    })
    .onEnd(() => {
      'worklet'
      savedScale.value = scale.value
    })

  const composed = Gesture.Simultaneous(panGesture, pinchGesture)

  // Hinge depends on direction (see header). Idle/forward use the left-edge
  // hinge; backward uses the right-edge hinge so the page sweeps rightward.
  const frontStyle = useAnimatedStyle(() => {
    const deg = flipAngle.value
    if (flipDir === 'backward') {
      return {
        transform: [
          { perspective: 1200 },
          { translateX: halfW },
          { rotateY: `${deg}deg` },
          { translateX: -halfW },
        ],
      }
    }
    return {
      transform: [
        { perspective: 1200 },
        { translateX: -halfW },
        { rotateY: `${deg}deg` },
        { translateX: halfW },
      ],
    }
  })

  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width: pageW, height: pageH }, zoomStyle]}>
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
          <View style={{ flex: 1 }}>{pages[currentIdx]}</View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
})
