// Geographic section — one passport page section with header, stops, and prize.
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LocationBox } from './LocationBox'
import type { PassportPage, Stop, Stamp, StampSlotState, StampPlacement } from '../../types'
import { palette } from '../../lib/colors'

interface Props {
  page: PassportPage
  stops: Stop[]
  stamps: Record<string, Stamp>
  slotStates: Record<string, StampSlotState>
  onStampPlaced: (stopId: string, placement: StampPlacement) => void
  onPressStart: (stopId: string) => void
  onPressCancel: (stopId: string) => void
}

export function GeographicSection({
  page,
  stops,
  stamps,
  slotStates,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  const allStamped = stops.length > 0 && stops.every((s) => stamps[s.id])

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <View style={styles.headerLine} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.sectionName}>{page.section_name.toUpperCase()}</Text>
          {page.section_tagline && (
            <Text style={styles.tagline}>{page.section_tagline}</Text>
          )}
        </View>
        <View style={styles.headerLine} />
      </View>

      {/* Location boxes */}
      <View style={styles.stops}>
        {stops.map((stop) => (
          <LocationBox
            key={stop.id}
            stop={stop}
            slotState={slotStates[stop.id] ?? 'dormant'}
            stamp={stamps[stop.id]}
            onStampPlaced={(placement) => onStampPlaced(stop.id, placement)}
            onPressStart={() => onPressStart(stop.id)}
            onPressCancel={() => onPressCancel(stop.id)}
          />
        ))}
      </View>

      {/* Prize description */}
      {page.prize_description && (
        <View style={[styles.prize, allStamped && styles.prizeUnlocked]}>
          <Text style={styles.prizeLabel}>
            {allStamped ? '★ PRIZE UNLOCKED' : '★ COMPLETE TO EARN'}
          </Text>
          <Text style={styles.prizeText}>{page.prize_description}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: palette.accent,
    opacity: 0.6,
  },
  headerTextContainer: {
    marginHorizontal: 12,
    alignItems: 'center',
  },
  sectionName: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '700',
    color: palette.navy,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 1,
  },
  stops: {
    gap: 8,
  },
  prize: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#C9A84C60',
    paddingTop: 8,
    opacity: 0.5,
  },
  prizeUnlocked: {
    opacity: 1,
  },
  prizeLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: palette.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  prizeText: {
    fontSize: 12,
    color: '#333',
    fontStyle: 'italic',
  },
})
