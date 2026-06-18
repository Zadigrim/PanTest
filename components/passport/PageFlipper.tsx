// Page-flip + pinch-to-zoom + pan-while-zoomed.
//
// Flip direction (BLD fix): the current page is always on top and animates
// away to reveal the destination beneath. The HINGE depends on direction so
// the motion matches the swipe:
//   • forward  (swipe left):  left-edge hinge, 0 → +180  → page turns LEFT.
//   • backward (swipe right): right-edge hinge, 0 → −180 → page turns RIGHT.
//
// Governing gesture rule — zoom scale is the single switch, no overlap state:
//   • scale ≈ 1×: one-finger horizontal drag = swipe-to-turn-page.
//   • scale > 1×: one-finger drag = PAN, clamped to content bounds; page-turn
//     is disabled and dragging to/past the edge stops at the clamp (no
//     edge-spill into a page turn). Page-turn re-arms at ≈1×.
//
// `scale` is LIFTED to PassportScreen and passed in (also threaded to the
// stamp boxes so tap-to-stamp can gate on zoom). PageFlipper writes it from
// the pinch; pan/page-turn read it. savedScale + pan translates stay local.
import React, {
  useState, useCallback, useRef, forwardRef, useImperativeHandle,
} from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  type SharedValue,
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
  /** Lifted zoom scale (shared with PassportScreen + the stamp boxes). When
   *  omitted, a local one is used so the component stays standalone-safe. */
  scale?: SharedValue<number>
}

const FLIP_DURATION = 370
const MAX_ZOOM = 3

export const PageFlipper = forwardRef<PageFlipperHandle, Props>(function PageFlipper(
  { pages, initialIndex = 0, onPageChange, scale: scaleProp },
  ref,
) {
  const { pageW, pageH } = usePageDimensions()
  const halfW = pageW / 2

  const [currentIdx, setCurrentIdx] = useState(initialIndex)
  const [nextIdx, setNextIdx] = useState<number | null>(null)
  const [flipDir, setFlipDir] = useState<'forward' | 'backward' | null>(null)
  const flipping = useRef(false)
  const flipAngle = useSharedValue(0)

  // Pinch zoom — `scale` may be lifted in from the screen.
  const localScale = useSharedValue(1)
  const scale = scaleProp ?? localScale
  const savedScale = useSharedValue(1)

  // Pan-while-zoomed translation (screen space). saved* hold the committed
  // offset so a new drag accumulates from where the last one ended.
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const resetPan = useCallback(() => {
    'worklet'
    translateX.value = withTiming(0)
    translateY.value = withTiming(0)
    savedTranslateX.value = 0
    savedTranslateY.value = 0
  }, [translateX, translateY, savedTranslateX, savedTranslateY])

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

  // One Pan gesture serves both modes, switched purely on scale:
  //   zoomed → translate (clamped); 1× → page-turn on release.
  // minDistance lets a tap (< 8px) fall through to the stamp box's Tap.
  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      'worklet'
      if (scale.value <= 1.01) return // 1× → no pan (page-turn decided on end)
      const maxX = (pageW * (scale.value - 1)) / 2
      const maxY = (pageH * (scale.value - 1)) / 2
      const nx = savedTranslateX.value + e.translationX
      const ny = savedTranslateY.value + e.translationY
      translateX.value = nx < -maxX ? -maxX : nx > maxX ? maxX : nx
      translateY.value = ny < -maxY ? -maxY : ny > maxY ? maxY : ny
    })
    .onEnd((e) => {
      'worklet'
      if (scale.value > 1.05) {
        // Zoomed: commit the pan. Page-turn is disabled — no edge-spill.
        savedTranslateX.value = translateX.value
        savedTranslateY.value = translateY.value
        return
      }
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
      // Pinched back to ~1× → snap clean and recenter (re-arms page-turn/tap).
      if (scale.value <= 1.01) {
        scale.value = withTiming(1)
        savedScale.value = 1
        resetPan()
      }
    })

  const composed = Gesture.Simultaneous(panGesture, pinchGesture)

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

  // Translate in screen space (applied after scale), then scale.
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

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
