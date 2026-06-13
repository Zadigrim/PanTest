// Unified post-stamp capture surface. Replaces the previous Alert in
// app/passport/[id].tsx that asked "Add a journal entry? Yes/Skip" and
// pushed the modal /journal/${stampId} route.
//
// Per the Minimum Active spec: BOTH voice and photo are independently
// optional. Use either, both, or neither. Dismissing returns to the
// passport page with the new stamp visible — no forced step, no second
// prompt. The page-completion token (when the stamp completed a section)
// is shown as a banner above the JournalEntry primitives, so it isn't
// dropped by the surface replacement.
//
// Reuse, don't reinvent: this is a thin Modal wrapper around <JournalEntry>.
// Voice transcription, photo enqueuing, and mood input all flow through the
// component's existing primitives so there's no duplicate transcription or
// upload logic. JournalEntry.onSaved fires when the user taps its Save
// button; we forward that to onClose so saving dismisses the sheet.
import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { JournalEntry } from '../journal/JournalEntry'
import { palette } from '../../lib/colors'

interface Props {
  stampId: string | null
  // The stop just stamped — drives the (separate, public) review surface.
  stopId: string | null
  userId: string
  // When the stamp completed a section, the redemption token info is
  // surfaced inline above the journal primitives so it isn't dropped by
  // replacing the previous Alert.
  redemptionCode: string | null
  onClose: () => void
}

export function PostStampCaptureSheet({ stampId, stopId, userId, redemptionCode, onClose }: Props) {
  const visible = Boolean(stampId)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>✓ Stamped</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {redemptionCode && (
            <View style={styles.tokenBanner}>
              <Text style={styles.tokenLabel}>★ Section complete — redemption code</Text>
              <Text style={styles.tokenCode}>{redemptionCode}</Text>
              <Text style={styles.tokenHint}>Show this to claim your prize</Text>
            </View>
          )}

          {stampId && (
            <View style={styles.body}>
              <JournalEntry
                stampId={stampId}
                userId={userId}
                onSaved={onClose}
              />
            </View>
          )}

          {/* Public review is a SEPARATE, outward-facing record from the
              private journal above — offered as a distinct action, not mixed
              into the journal primitives. */}
          {stopId && (
            <TouchableOpacity
              style={styles.reviewLink}
              onPress={() => { onClose(); router.push(`/stop/${stopId}`) }}
              accessibilityRole="button"
            >
              <Text style={styles.reviewLinkText}>Leave a public review for this stop</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '60%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece3',
  },
  title: { fontSize: 18, fontWeight: '700', color: palette.green },
  doneText: { fontSize: 15, color: palette.accent, fontWeight: '600' },
  tokenBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: palette.navy,
    borderRadius: 10,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 11,
    color: palette.accent,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tokenCode: {
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: palette.cream,
    letterSpacing: 4,
    marginBottom: 4,
  },
  tokenHint: { fontSize: 12, color: 'rgba(245,240,232,0.7)' },
  body: { flex: 1 },
  reviewLink: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  reviewLinkText: { fontSize: 14, color: palette.blue, fontWeight: '600' },
})
