// Passport page — renders the designer artboard scaled to fit the screen width.
// Background layers (bottom→top): paper color → pattern/image → grain → vignette → binding shadow → canvas
import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, Pattern, Path, Rect, Filter, FeTurbulence, FeColorMatrix } from 'react-native-svg'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import { DesignerCanvas } from './DesignerCanvas'
import type { Passport, PassportPage as PassportPageType, Stop, Stamp, StampSlotState, StampPlacement } from '../../types'

// Designer artboard width in logical units
const ARTBOARD_W = 612

interface Props {
  passport: Passport
  page: PassportPageType
  stops: Stop[]
  stamps: Record<string, Stamp>
  slotStates: Record<string, StampSlotState>
  width: number
  height: number
  onStampPlaced: (stopId: string, placement: StampPlacement) => void
  onPressStart: (stopId: string) => void
  onPressCancel: (stopId: string) => void
}

export function PassportPage({
  passport,
  page,
  stops,
  stamps,
  slotStates,
  width,
  height,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  // Single canonical transform: the 612×869 artboard maps to the screen by
  // ONE scale from a top-left origin. The content box is exactly
  // width × (869·scale) — every layer (paper, patterns, background image,
  // elements, LocationBoxes, stamps) lives inside it, so they scale and
  // align together at any size. Previously the box used the frame's height
  // (wrong aspect), so the `contain` background letterboxed vertically while
  // elements anchored top — that gap was the stops-vs-background drift.
  // The `height` prop (frame's pageH) is intentionally not used for the box.
  const scale = width / ARTBOARD_W
  const artboardH = 869 * scale
  void height

  // Background resolution — aligned with okujiKobo's PageBackground.tsx so
  // a page looks the same on both surfaces.
  //   paper_color: page-level only; literal 'F5F2EC' fallback. (Designer
  //     never inherits a passport-level paper_color; mobile used to, which
  //     drifted rendered color.)
  //   background_opacity: 10..100 stored, clamped if missing, divided by 100
  //     for opacity. Default 100 (NOT 11) — matches web. The legacy mobile
  //     11% default came from passport.illus_opacity, which the web side
  //     ignores; pages with no per-page opacity were rendering nearly
  //     transparent on mobile vs opaque on web.
  const paperColor = `#${page.paper_color ?? 'F5F2EC'}`
  const bgType = page.background_type ?? 'guilloche'
  const bgColor = `#${page.background_color ?? '0D1B2A'}`
  const bgOpacityPct = Math.min(100, Math.max(10, page.background_opacity ?? 100))
  const bgOpacity = bgOpacityPct / 100
  const customBgOpacity = (page.custom_background_opacity ?? 100) / 100

  return (
    <View style={[styles.page, { width, height: artboardH, backgroundColor: paperColor }]}>
      {/* Guilloche security-print pattern */}
      {bgType === 'guilloche' && (
        <GuillocheBackground color={bgColor} opacity={bgOpacity} width={width} height={artboardH} />
      )}

      {/* Grid pattern */}
      {bgType === 'grid' && (
        <GridBackground color={bgColor} opacity={bgOpacity} width={width} height={artboardH} />
      )}

      {/* Custom + okuji-preset background image (both store an image URL) */}
      {(bgType === 'custom' || bgType === 'okuji') && !!page.background_image_url && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          <Image
            source={{ uri: page.background_image_url }}
            style={[StyleSheet.absoluteFill, { opacity: customBgOpacity }]}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Paper grain — SVG fractal noise to match the web designer's
          feTurbulence treatment (PageBackground.tsx). Same baseFrequency,
          saturated to 0, painted at 4% opacity. Visual parity with web,
          not pixel-identical. Replaces the legacy flat 2.5% black overlay. */}
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        width="100%"
        height="100%"
      >
        <Defs>
          <Filter id="paper-grain">
            <FeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <FeColorMatrix type="saturate" values="0" />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#paper-grain)" opacity={0.04} />
      </Svg>

      {/* Corner vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0.06)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.06)']}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.3, 0.7, 1]}
        pointerEvents="none"
      />

      {/* Binding shadow on left edge */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.08, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Designer canvas — all elements and stamp boxes at absolute positions */}
      <DesignerCanvas
        page={page}
        stops={stops}
        stamps={stamps}
        slotStates={slotStates}
        scale={scale}
        artboardH={artboardH}
        onStampPlaced={onStampPlaced}
        onPressStart={onPressStart}
        onPressCancel={onPressCancel}
      />

      {/* Page number */}
      <Text style={styles.pageNumber}>{page.page_order}</Text>
    </View>
  )
}

function GridBackground({
  color,
  opacity,
  width,
  height,
}: {
  color: string
  opacity: number
  width: number
  height: number
}) {
  const minorId = 'rn-grid-minor'
  const majorId = 'rn-grid-major'
  const clampedOpacity = Math.max(0.1, Math.min(1, opacity))
  const majorOpacity = Math.min(1, clampedOpacity * 2.5)

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: clampedOpacity }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id={minorId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <Path d="M 12 0 L 0 0 0 12" fill="none" stroke={color} strokeWidth="0.35" />
          </Pattern>
          <Pattern id={majorId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <Rect width="60" height="60" fill={`url(#${minorId})`} />
            <Path d="M 60 0 L 0 0 0 60" fill="none" stroke={color} strokeWidth="0.8" opacity={majorOpacity} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${majorId})`} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
    borderRadius: 2,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.025,
    backgroundColor: '#000',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
  },
})
