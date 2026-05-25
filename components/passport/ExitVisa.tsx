// Exit visa page — section completion certificate shown after each stops page.
// Shows a "CERTIFIED COMPLETE" seal when all stops in the section are stamped.
import React from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import type { Passport, PassportPage, Stop, Stamp } from '../../types'
import { palette } from '../../lib/colors'

interface Props {
  passport: Passport
  page: PassportPage
  stops: Stop[]
  stamps: Record<string, Stamp>
  chapterNumber: number
}

const PAPER = palette.paper
const INK = palette.ink
const GOLD = palette.accent
const GREEN = '#2E7D4D'
const RED = palette.red

export function ExitVisa({ passport, page, stops, stamps, chapterNumber }: Props) {
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  const stampedCount = stops.filter((s) => stamps[s.id]).length
  const isComplete = stops.length > 0 && stampedCount === stops.length
  const completedAt = isComplete
    ? Object.values(stamps)
        .map((s) => s.verified_at)
        .sort()
        .pop()
    : null

  const completedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground
        color={passport.illus_color}
        opacity={passport.illus_opacity * 0.7}
        width={pageW}
        height={pageH}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>EXIT VISA</Text>
        <View style={styles.headerUnderline} />
      </View>

      <View style={styles.body}>
        {/* Chapter reference */}
        <Text style={styles.chapterRef}>
          Chapter {String(chapterNumber).padStart(2, '0')} — {page.section_name}
        </Text>

        <View style={styles.divider} />

        {/* Stamp grid summary */}
        <View style={styles.stampGrid}>
          {stops.map((stop, i) => {
            const stamped = !!stamps[stop.id]
            return (
              <View key={stop.id} style={styles.stampCell}>
                <View style={[styles.stampCircle, stamped && styles.stampCircleFilled]}>
                  {stamped ? (
                    <Text style={styles.stampCheck}>✓</Text>
                  ) : (
                    <Text style={styles.stampNum}>{i + 1}</Text>
                  )}
                </View>
                <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.divider} />

        {/* Completion certificate */}
        {isComplete ? (
          <View style={styles.certificate}>
            <View style={styles.certBorder}>
              <Text style={styles.certTitle}>CERTIFIED COMPLETE</Text>
              <Text style={styles.certDate}>{completedDate}</Text>
              <Text style={styles.certSeal}>✦</Text>
              {page.prize_description ? (
                <View style={styles.prizeBlock}>
                  <Text style={styles.prizeLabel}>PRIZE UNLOCKED</Text>
                  <Text style={styles.prizeDesc}>{page.prize_description}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.incomplete}>
            <Text style={styles.incompleteText}>
              {stampedCount} of {stops.length} stops completed
            </Text>
            <Text style={styles.incompleteHint}>
              Return to collect all stamps to unlock the exit visa.
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <Text style={styles.footerText}>OKUJI · OFFICIAL RECORD</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
  },
  header: {
    paddingTop: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 9,
    letterSpacing: 5,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerUnderline: {
    width: 90,
    height: 0.5,
    backgroundColor: `${GOLD}55`,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  chapterRef: {
    fontFamily: 'serif',
    fontSize: 14,
    color: INK,
    textAlign: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 0.5,
    backgroundColor: `${INK}22`,
    marginVertical: 16,
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  stampCell: {
    alignItems: 'center',
    width: 56,
  },
  stampCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: `${INK}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  stampCircleFilled: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  stampCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stampNum: {
    fontSize: 12,
    color: `${INK}55`,
    fontFamily: 'serif',
  },
  stopName: {
    fontSize: 8,
    color: `${INK}66`,
    textAlign: 'center',
    lineHeight: 11,
  },
  certificate: {
    alignItems: 'center',
    marginTop: 4,
  },
  certBorder: {
    borderWidth: 1,
    borderColor: `${GOLD}66`,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  certTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 6,
  },
  certDate: {
    fontFamily: 'serif',
    fontSize: 12,
    color: `${INK}88`,
    marginBottom: 10,
  },
  certSeal: {
    fontSize: 22,
    color: GOLD,
    marginBottom: 8,
  },
  prizeBlock: {
    marginTop: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${GOLD}44`,
    paddingTop: 8,
    width: '100%',
  },
  prizeLabel: {
    fontSize: 8,
    letterSpacing: 2.5,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 4,
  },
  prizeDesc: {
    fontSize: 11,
    color: `${INK}77`,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  incomplete: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  incompleteText: {
    fontFamily: 'serif',
    fontSize: 13,
    color: `${INK}66`,
    marginBottom: 8,
  },
  incompleteHint: {
    fontSize: 10,
    color: `${INK}44`,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  footer: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerRule: {
    width: '70%',
    height: 0.5,
    backgroundColor: `${GOLD}33`,
  },
  footerText: {
    fontSize: 7,
    letterSpacing: 3,
    color: `${INK}33`,
    fontWeight: '600',
  },
})
