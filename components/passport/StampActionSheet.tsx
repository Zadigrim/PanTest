// Stamp-action sheet — the discoverable entry point that replaces the hidden
// press-and-hold trigger. A tap on a stop region (at 1x) opens this; it does
// NOT replace the stamp mechanic. "Stamp this stop" arms the existing
// expressive press-hold gesture (StampGestureInteraction, migration 040) so
// the user places the stamp exactly as before. "Get directions" hands the
// stop's coordinate to the OS maps app (hidden when the stop has no coords).
//
// Reuses the PostStampCaptureSheet Modal/bottom-sheet pattern — no sheet lib.
import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { palette } from '../../lib/colors'

interface Props {
  visible: boolean
  stopName: string | null
  /** Show "Get directions" only when the stop carries coordinates. The 5
   *  unpinned hero landmarks are coord-null until pinned → Stamp-only. */
  hasCoords: boolean
  onStamp: () => void
  onDirections: () => void
  onClose: () => void
}

export function StampActionSheet({ visible, stopName, hasCoords, onStamp, onDirections, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        {/* Inner panel stops the backdrop tap from closing when tapped. */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>{stopName ?? 'This stop'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Text style={styles.doneText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.action} onPress={onStamp} accessibilityRole="button">
              <Ionicons name="ribbon-outline" size={22} color={palette.green} />
              <View style={styles.actionText}>
                <Text style={styles.actionLabel}>Stamp this stop</Text>
                <Text style={styles.actionHint}>Press and hold on the stamp to place it</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.hairline} />
            </TouchableOpacity>

            {hasCoords && (
              <TouchableOpacity style={styles.action} onPress={onDirections} accessibilityRole="button">
                <Ionicons name="navigate-outline" size={22} color={palette.blue} />
                <View style={styles.actionText}>
                  <Text style={styles.actionLabel}>Get directions to this stop</Text>
                  <Text style={styles.actionHint}>Opens your maps app</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={palette.hairline} />
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
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
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd', marginTop: 8, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0ece3',
  },
  title: { fontSize: 17, fontWeight: '700', color: palette.ink, flex: 1, marginRight: 12 },
  doneText: { fontSize: 15, color: palette.muted, fontWeight: '600' },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline,
  },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 16, fontWeight: '600', color: palette.ink },
  actionHint: { fontSize: 12, color: palette.muted, marginTop: 2 },
})
