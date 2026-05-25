// Section divider page — chapter opener between TOC/previous section and the stops page.
import React from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import type { Passport, PassportPage } from '../../types'
import { palette } from '../../lib/colors'

interface Props {
  passport: Passport
  page: PassportPage
  chapterNumber: number
}

const PAPER = palette.paper
const INK = palette.ink
const GOLD = palette.accent
const COVER_GREEN = '#2E7D4D'

export function SectionDivider({ passport, page, chapterNumber }: Props) {
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground
        color={passport.illus_color}
        opacity={passport.illus_opacity}
        width={pageW}
        height={pageH}
      />

      {/* Top accent band */}
      <LinearGradient
        colors={[COVER_GREEN, '#1a5c33']}
        style={styles.topBand}
      />

      {/* Chapter number in band */}
      <View style={styles.chapterNumContainer} pointerEvents="none">
        <Text style={styles.chapterLabel}>CHAPTER</Text>
        <Text style={styles.chapterNum}>{String(chapterNumber).padStart(2, '0')}</Text>
      </View>

      {/* Center content */}
      <View style={styles.centerContent}>
        {/* Top rule */}
        <View style={styles.goldRule} />

        {/* Section name */}
        <Text style={styles.sectionName}>{page.section_name}</Text>

        {/* Tagline */}
        {page.section_tagline ? (
          <Text style={styles.tagline}>{page.section_tagline}</Text>
        ) : null}

        {/* Bottom rule */}
        <View style={styles.goldRule} />

        {/* Prize hint */}
        {page.prize_description ? (
          <View style={styles.prizeHint}>
            <Text style={styles.prizeLabel}>PRIZE</Text>
            <Text style={styles.prizeDesc} numberOfLines={2}>
              {page.prize_description}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom page number */}
      <View style={styles.footer}>
        <Text style={styles.footerDash}>— </Text>
        <Text style={styles.footerText}>{chapterNumber}</Text>
        <Text style={styles.footerDash}> —</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  chapterNumContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterLabel: {
    fontSize: 8,
    letterSpacing: 4,
    color: 'rgba(246,241,230,0.6)',
    fontWeight: '700',
    marginBottom: 2,
  },
  chapterNum: {
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: '700',
    color: palette.paper,
    letterSpacing: 2,
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  goldRule: {
    width: 100,
    height: 0.5,
    backgroundColor: `${GOLD}66`,
    marginVertical: 14,
  },
  sectionName: {
    fontFamily: 'serif',
    fontSize: 24,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 30,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 12,
    color: `${INK}77`,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  prizeHint: {
    marginTop: 20,
    alignItems: 'center',
  },
  prizeLabel: {
    fontSize: 8,
    letterSpacing: 3,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 4,
  },
  prizeDesc: {
    fontSize: 11,
    color: `${INK}66`,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerDash: {
    fontSize: 10,
    color: `${INK}33`,
  },
  footerText: {
    fontFamily: 'serif',
    fontSize: 10,
    color: `${INK}44`,
    letterSpacing: 1,
  },
})
