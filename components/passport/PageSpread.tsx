// Landscape two-page spread (tablet). Renders two adjacent page nodes as an
// open-book spread and navigates a spread (two pages) at a time. Isolated from
// PageFlipper so the phone single-page experience is untouched.
//
// Deliberately simple (Option B): a light fade between spreads instead of the
// per-page curl, and no pinch-zoom. Because zoom is absent, the shared
// zoomScale stays 1, so the page's tap-to-stamp gate (which only fires at ≈1×)
// keeps working — the collector can stamp either page of the spread. The
// screen's existing prev/next chevrons drive navigation via the shared
// PageFlipperHandle.
import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { usePageDimensions } from './PassportFrame'
import type { PageFlipperHandle } from './PageFlipper'

interface Props {
  pages: React.ReactNode[]
  initialIndex?: number
  onPageChange?: (index: number) => void
}

export const PageSpread = forwardRef<PageFlipperHandle, Props>(function PageSpread(
  { pages, initialIndex = 0, onPageChange },
  ref,
) {
  const { pageW, pageH } = usePageDimensions()
  const spreadCount = Math.max(1, Math.ceil(pages.length / 2))
  const [spread, setSpread] = useState(Math.floor(initialIndex / 2))

  const goToSpread = useCallback((s: number) => {
    const clamped = Math.max(0, Math.min(s, spreadCount - 1))
    setSpread(clamped)
    // Report the LEFT page index so the screen's page indicator + prev/next
    // disabled state stay in sync with the shared handle contract.
    onPageChange?.(clamped * 2)
  }, [spreadCount, onPageChange])

  useImperativeHandle(ref, () => ({
    goTo(index: number) { goToSpread(Math.floor(index / 2)) },
    next() { goToSpread(spread + 1) },
    prev() { goToSpread(spread - 1) },
  }), [goToSpread, spread])

  const leftIdx = spread * 2
  const rightIdx = leftIdx + 1

  return (
    <Animated.View
      key={spread}
      entering={FadeIn.duration(180)}
      style={[styles.row, { width: pageW * 2, height: pageH }]}
    >
      <View style={{ width: pageW, height: pageH }}>{pages[leftIdx] ?? null}</View>
      <View style={{ width: pageW, height: pageH }}>
        {rightIdx < pages.length ? pages[rightIdx] : null}
      </View>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
})
