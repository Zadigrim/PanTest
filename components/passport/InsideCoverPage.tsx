// Inside front cover — bearer name, issue date, bearer no.
import React from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import type { Passport, CollectorPassport } from '../../types'

interface Props {
  passport: Passport
  collectorPassport: CollectorPassport
  bearerName: string
}

const PAPER = '#f6f1e6'
const INK = '#1f1d1a'
const GOLD = '#c9a84c'

export function InsideCoverPage({ passport, collectorPassport, bearerName }: Props) {
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  const issueDate = new Date(collectorPassport.acquired_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const bearerNo = collectorPassport.id.replace(/-/g, '').slice(0, 10).toUpperCase()

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground
        color={passport.illus_color}
        opacity={passport.illus_opacity * 0.6}
        width={pageW}
        height={pageH}
      />

      {/* Header band */}
      <View style={styles.header}>
        <Text style={styles.headerText}>PANOPLY PASSPORT</Text>
        <View style={styles.headerRule} />
      </View>

      {/* Main content */}
      <View style={styles.body}>
        {/* Passport title */}
        <Text style={styles.passportTitle}>{passport.title}</Text>

        <View style={styles.divider} />

        {/* Bearer block */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>BEARER</Text>
          <View style={styles.fieldLine} />
          <Text style={styles.fieldValue}>{bearerName || 'Collector'}</Text>
        </View>

        <View style={styles.row}>
          {/* Issue date */}
          <View style={[styles.fieldBlock, { flex: 1, marginRight: 16 }]}>
            <Text style={styles.fieldLabel}>ISSUE DATE</Text>
            <View style={styles.fieldLine} />
            <Text style={styles.fieldValue}>{issueDate}</Text>
          </View>

          {/* Bearer No */}
          <View style={[styles.fieldBlock, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>BEARER NO.</Text>
            <View style={styles.fieldLine} />
            <Text style={[styles.fieldValue, styles.monospace]}>{bearerNo}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Official notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            This passport is the exclusive property of the bearer and is
            issued to record participation in the Panoply programme.
            Report loss or damage immediately.
          </Text>
        </View>

        {/* Seal / crest area */}
        <View style={styles.seal}>
          <Text style={styles.sealEmblem}>{passport.cover_emblem ?? '🧭'}</Text>
          <Text style={styles.sealText}>OFFICIAL RECORD</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>panoply.app</Text>
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
    marginBottom: 4,
  },
  headerText: {
    fontSize: 9,
    letterSpacing: 4,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerRule: {
    width: '85%',
    height: 1,
    backgroundColor: `${GOLD}44`,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  passportTitle: {
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  divider: {
    height: 0.5,
    backgroundColor: `${INK}22`,
    marginVertical: 16,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
  },
  fieldLabel: {
    fontSize: 8,
    letterSpacing: 2.5,
    color: `${INK}66`,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${INK}33`,
    marginBottom: 6,
  },
  fieldValue: {
    fontFamily: 'serif',
    fontSize: 15,
    color: INK,
  },
  monospace: {
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 1,
  },
  noticeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${INK}22`,
    borderRadius: 2,
    padding: 12,
    marginTop: 4,
  },
  noticeText: {
    fontSize: 9,
    color: `${INK}55`,
    lineHeight: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  seal: {
    alignItems: 'center',
    marginTop: 24,
  },
  sealEmblem: {
    fontSize: 36,
    marginBottom: 6,
  },
  sealText: {
    fontSize: 8,
    letterSpacing: 3,
    color: `${INK}44`,
    fontWeight: '700',
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: `${INK}33`,
    letterSpacing: 2,
  },
})
