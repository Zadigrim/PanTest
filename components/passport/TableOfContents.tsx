// Table of contents — chapter list with ✓ / ½ / · completion status per section.
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import type { Passport, PassportPage, Stop, Stamp } from '../../types'

interface Props {
  passport: Passport
  pages: PassportPage[]
  stops: Record<string, Stop[]>
  stamps: Record<string, Record<string, Stamp>>
  // screen index of first stops-page for each page (to navigate directly)
  pageScreenIndex: Record<string, number>
  onNavigate: (screenIndex: number) => void
}

const PAPER = '#f6f1e6'
const INK = '#1f1d1a'
const GOLD = '#c9a84c'
const GREEN = '#2E7D4D'
const RED = '#9b2335'

function sectionStatus(
  stops: Stop[],
  stamps: Record<string, Stamp>,
): '✓' | '½' | '·' {
  if (stops.length === 0) return '·'
  const stamped = stops.filter((s) => stamps[s.id]).length
  if (stamped === 0) return '·'
  if (stamped === stops.length) return '✓'
  return '½'
}

function statusColor(status: '✓' | '½' | '·') {
  if (status === '✓') return GREEN
  if (status === '½') return GOLD
  return `${INK}44`
}

export function TableOfContents({
  passport,
  pages,
  stops,
  stamps,
  pageScreenIndex,
  onNavigate,
}: Props) {
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  const allComplete = pages.every(
    (p) => sectionStatus(stops[p.id] ?? [], stamps[p.id] ?? {}) === '✓',
  )

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground
        color={passport.illus_color}
        opacity={passport.illus_opacity * 0.5}
        width={pageW}
        height={pageH}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRule} />
        <Text style={styles.headerText}>CONTENTS</Text>
        <View style={styles.headerRule} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {pages.map((page, i) => {
          const pageStops = stops[page.id] ?? []
          const pageStamps = stamps[page.id] ?? {}
          const status = sectionStatus(pageStops, pageStamps)
          const color = statusColor(status)
          const screenIdx = pageScreenIndex[page.id]

          return (
            <TouchableOpacity
              key={page.id}
              style={styles.row}
              onPress={() => screenIdx != null && onNavigate(screenIdx)}
              activeOpacity={0.65}
            >
              {/* Chapter number */}
              <Text style={styles.chapterNum}>{String(i + 1).padStart(2, '0')}</Text>

              {/* Dot leaders */}
              <View style={styles.leadersWrap}>
                <Text style={styles.sectionName} numberOfLines={1}>
                  {page.section_name}
                </Text>
                <View style={styles.leaders} />
              </View>

              {/* Stop count */}
              <Text style={styles.stopCount}>
                {pageStops.length} {pageStops.length === 1 ? 'stop' : 'stops'}
              </Text>

              {/* Status glyph */}
              <Text style={[styles.statusGlyph, { color }]}>{status}</Text>
            </TouchableOpacity>
          )
        })}

        {/* Completion notice */}
        {allComplete && pages.length > 0 && (
          <View style={styles.completeNotice}>
            <Text style={styles.completeText}>✦ Passport Complete ✦</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.legend}>
          <Text style={[styles.legendGlyph, { color: GREEN }]}>✓</Text>
          <Text style={styles.legendLabel}>Complete</Text>
          <Text style={[styles.legendGlyph, { color: GOLD }]}>½</Text>
          <Text style={styles.legendLabel}>In progress</Text>
          <Text style={[styles.legendGlyph, { color: `${INK}44` }]}>·</Text>
          <Text style={styles.legendLabel}>Not started</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    marginBottom: 16,
    gap: 10,
  },
  headerRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: `${GOLD}55`,
  },
  headerText: {
    fontSize: 9,
    letterSpacing: 4,
    color: GOLD,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${INK}16`,
    gap: 8,
  },
  chapterNum: {
    fontFamily: 'serif',
    fontSize: 10,
    color: `${INK}44`,
    width: 22,
  },
  leadersWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  sectionName: {
    fontFamily: 'serif',
    fontSize: 13,
    color: INK,
    flexShrink: 1,
  },
  leaders: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${INK}33`,
    marginBottom: 3,
    marginLeft: 4,
  },
  stopCount: {
    fontSize: 9,
    color: `${INK}55`,
    width: 44,
    textAlign: 'right',
  },
  statusGlyph: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  completeNotice: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${GOLD}44`,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${GOLD}44`,
  },
  completeText: {
    fontFamily: 'serif',
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  footer: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legendGlyph: {
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '700',
  },
  legendLabel: {
    fontSize: 8,
    color: `${INK}55`,
    marginRight: 8,
  },
})
