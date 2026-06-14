// Back-pages — the collector's private travel record at the end of the book.
//
// Two surfaces, both sized to the canonical page space (usePageDimensions),
// so they sit in the PageFlipper exactly like designed pages:
//   - BackJournalCover: the divider that opens the journal section.
//   - BackJournalPage:   one stamped stop's record.
//
// PRIVATE to the collector. The data is assembled by useBackPages from
// auth.uid()-scoped queries; these components only render it. Location shown
// is the stop NAME + the stamp time (verified_at) — never precise GPS.
import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { GuillocheBackground } from '../ui/GuillocheBackground'
import { usePageDimensions } from './PassportFrame'
import { StampArtwork } from '../stamp/StampArtwork'
import { palette } from '../../lib/colors'
import type { BackPageRecord } from '../../hooks/useBackPages'

const PAPER = palette.paper
const INK = palette.ink
const GOLD = palette.accent

function formatVisited(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function BackJournalCover({ count }: { count: number }) {
  const { pageW, pageH } = usePageDimensions()
  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground color={GOLD} opacity={0.08} width={pageW} height={pageH} />
      <View style={styles.coverInner}>
        <Text style={styles.coverEyebrow}>FIELD NOTES</Text>
        <View style={styles.coverRule} />
        <Text style={styles.coverTitle}>Your journey</Text>
        <Text style={styles.coverSub}>
          {count === 1 ? '1 stop, recorded' : `${count} stops, recorded`}
        </Text>
        <Text style={styles.coverHint}>
          A private record of where you went — kept only for you.
        </Text>
      </View>
    </View>
  )
}

export function BackJournalPage({ record }: { record: BackPageRecord }) {
  const { pageW, pageH } = usePageDimensions()
  const { stop, stamp, verifiedAt, journalBody, mood, photos, review } = record
  const hasContent = !!journalBody || photos.length > 0 || !!review

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: PAPER }]}>
      <GuillocheBackground color={stop.stamp_color} opacity={0.06} width={pageW} height={pageH} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Header: stamp mark + stop name + visited time (baseline, always). */}
        <View style={styles.headRow}>
          <View style={styles.stampWrap}>
            <StampArtwork
              stop={stop}
              size={64}
              rotationDeg={stamp.rotation_deg}
              saturation={stamp.saturation}
              smudgeDx={stamp.smudge_dx}
              smudgeDy={stamp.smudge_dy}
              smudgeIntensity={stamp.smudge_intensity}
              tiltDx={stamp.tilt_dx}
              tiltDy={stamp.tilt_dy}
              tiltIntensity={stamp.tilt_intensity}
              earnedAt={verifiedAt}
            />
          </View>
          <View style={styles.headText}>
            <Text style={styles.stopName} numberOfLines={2}>{stop.name}</Text>
            {stop.location_name ? (
              <Text style={styles.locationName} numberOfLines={1}>{stop.location_name}</Text>
            ) : null}
            <Text style={styles.visited}>{formatVisited(verifiedAt)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Photos. */}
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.map((p) => (
              <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
            ))}
          </ScrollView>
        )}

        {/* Journal entry. */}
        {journalBody ? <Text style={styles.journalBody}>{journalBody}</Text> : null}
        {mood != null && (
          <View style={styles.moodRow}>
            <Text style={styles.moodLabel}>How it felt</Text>
            <Text style={styles.moodDots}>{'●'.repeat(mood)}{'○'.repeat(Math.max(0, 5 - mood))}</Text>
          </View>
        )}

        {/* The collector's own review echo (toggle-gated upstream). */}
        {review && (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewLabel}>Your review</Text>
            <Text style={styles.reviewStars}>
              {'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}
            </Text>
            {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
          </View>
        )}

        {/* Baseline-only stop: honest, no fabricated content. */}
        {!hasContent && (
          <Text style={styles.emptyNote}>Stamped — no journal entry for this stop.</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },

  // Cover
  coverInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  coverEyebrow: { fontSize: 11, letterSpacing: 4, color: GOLD, fontWeight: '700' },
  coverRule: { width: 56, height: 1, backgroundColor: `${GOLD}66`, marginVertical: 14 },
  coverTitle: { fontFamily: 'serif', fontSize: 30, color: INK, fontWeight: '700', marginBottom: 6 },
  coverSub: { fontFamily: 'serif', fontSize: 15, color: palette.muted, marginBottom: 18 },
  coverHint: { fontSize: 12, color: palette.muted, textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },

  // Record page
  body: { padding: 24, paddingBottom: 48 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stampWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1 },
  stopName: { fontFamily: 'serif', fontSize: 20, fontWeight: '700', color: INK },
  locationName: { fontSize: 12, color: palette.muted, marginTop: 2 },
  visited: { fontSize: 12, color: GOLD, fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: `${INK}22`, marginVertical: 16 },

  photoStrip: { marginBottom: 14 },
  photo: { width: 130, height: 130, borderRadius: 8, marginRight: 10, backgroundColor: '#e6dfce' },

  journalBody: { fontSize: 15, lineHeight: 23, color: INK, fontFamily: 'serif' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  moodLabel: { fontSize: 11, letterSpacing: 1.5, color: palette.muted, fontWeight: '600', textTransform: 'uppercase' },
  moodDots: { fontSize: 14, color: GOLD, letterSpacing: 2 },

  reviewBox: {
    marginTop: 18, padding: 14, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: `${INK}22`, backgroundColor: 'rgba(201,168,76,0.06)',
  },
  reviewLabel: { fontSize: 11, letterSpacing: 1.5, color: palette.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  reviewStars: { fontSize: 16, color: GOLD, letterSpacing: 2, marginBottom: 6 },
  reviewBody: { fontSize: 14, lineHeight: 21, color: INK },

  emptyNote: { fontSize: 13, color: palette.muted, fontStyle: 'italic' },
})
