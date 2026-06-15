// Inside front cover. Two render paths:
//
//   - Designed inside-cover (preferred): renders the BACK panel
//     (x=0..612) of passport.cover_inside_data via CoverPanel. The
//     inside-front-cover is the LEFT panel of the inside spread, because
//     when you open a book the inside-front-cover faces you on the
//     left.
//   - Procedural fallback: the ceremonial 'official record' page with
//     bearer name, issue date, and bearer number. Used when
//     cover_inside_data is null.
//
// Either way the page shows passport metadata (bearer fields don't move
// between cases — they're still useful overlays, but in the designed
// path the creator's artwork takes precedence and bearer info is shown
// at the bottom in a smaller treatment).
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import { usePageDimensions } from './PassportFrame'
import { CoverPanel } from './CoverPanel'
import type { Passport, CollectorPassport } from '../../types'
import { palette } from '../../lib/colors'

interface Props {
  passport: Passport
  collectorPassport: CollectorPassport
  bearerName: string
}

const PAPER = palette.paper
const INK = palette.ink
const GOLD = palette.accent

export function InsideCoverPage({ passport, collectorPassport, bearerName }: Props) {
  // Canonical 612:869 page space — same hook the regular pages, outer
  // cover, ToC, and exit-visa use. The earlier sw*0.82 / sh*0.96 sizing
  // gave the inside cover a device-dependent aspect (white bars + distorted
  // CoverPanel art); this makes it conform like every other surface.
  const { pageW, pageH } = usePageDimensions()

  const issueDate = new Date(collectorPassport.acquired_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const bearerNo = collectorPassport.id.replace(/-/g, '').slice(0, 10).toUpperCase()

  // Designed inside-cover path: renders the back panel (x=0..612, the
  // inside-front face) of cover_inside_data. Bearer fields overlay as a
  // small footer block so the designer's artwork stays the visual focus.
  if (passport.cover_inside_data) {
    return (
      <View style={[styles.page, { width: pageW, height: pageH }]}>
        <CoverPanel
          data={passport.cover_inside_data}
          half="back"
          pageWidth={pageW}
          pageHeight={pageH}
        />
        {/* Bearer footer overlay — translucent paper card pinned to the
            bottom so the inside-cover still functions as the bearer
            record without obscuring the designer's artwork. */}
        <View style={styles.bearerOverlay} pointerEvents="none">
          <Text style={styles.overlayBearer}>
            {bearerName || 'Collector'}
          </Text>
          <Text style={styles.overlayMeta}>
            Issued {issueDate} · {bearerNo}
          </Text>
        </View>
      </View>
    )
  }

  // Procedural fallback (no designed inside-cover).
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
        <Text style={styles.headerText}>OKUJI PASSPORT</Text>
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
            issued to record participation in the Okuji programme.
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
        <Text style={styles.footerText}>okuji.app</Text>
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
  // Designed-inside-cover overlay: translucent card pinned to the bottom
  // so the designer's artwork remains the focus but bearer info is still
  // recorded on the inside-cover page (which the procedural fallback
  // makes the central concept of the page).
  bearerOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 240, 232, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${INK}22`,
    alignItems: 'center',
  },
  overlayBearer: {
    fontFamily: 'serif',
    fontSize: 14,
    color: INK,
    fontWeight: '600',
  },
  overlayMeta: {
    fontSize: 9,
    color: `${INK}88`,
    letterSpacing: 1,
    marginTop: 2,
  },
})
