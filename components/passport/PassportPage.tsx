// Individual passport page with guilloche background, paper texture, vignette.
// Page content layers (bottom to top):
//   1. paper color  2. guilloche SVG  3. paper grain  4. vignette  5. binding shadow  6. content
import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import { GeographicSection } from './GeographicSection'
import type { Passport, PassportPage as PassportPageType, Stop, Stamp, StampSlotState, StampPlacement } from '../../types'

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
  return (
    <View style={[styles.page, { width, height, backgroundColor: passport.paper_color }]}>
      {/* Layer 2: Guilloche background illustration */}
      <GuillocheBackground
        color={passport.illus_color}
        opacity={passport.illus_opacity}
        width={width}
        height={height}
      />

      {/* Layer 3: Paper grain texture */}
      <View style={styles.grain} pointerEvents="none" />

      {/* Layer 4: Corner vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0.06)', 'transparent', 'transparent', 'rgba(0,0,0,0.06)']}
        style={[StyleSheet.absoluteFill, styles.vignette]}
        locations={[0, 0.3, 0.7, 1]}
        pointerEvents="none"
      />

      {/* Layer 5: Binding shadow on left edge */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.08, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Layer 6: Page content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GeographicSection
          page={page}
          stops={stops}
          stamps={stamps}
          slotStates={slotStates}
          onStampPlaced={onStampPlaced}
          onPressStart={onPressStart}
          onPressCancel={onPressCancel}
        />
      </ScrollView>

      {/* Page number */}
      <Text style={styles.pageNumber}>{page.page_order}</Text>
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
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
