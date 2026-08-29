// Voice setup sheet — shown when on-device voice can't run yet because the
// phone's offline recognition model isn't downloaded / on-device recognition
// isn't turned on. Replaces the old dead-end "voice isn't available" alert
// with a guided, collector-voiced path to fix it, while always keeping
// "Type instead" as a no-pressure escape.
//
// Presentational only: all detection + the actual actions (trigger the model
// download, open settings, re-attempt) live in VoiceRecorder. This mirrors the
// StampActionSheet bottom-sheet pattern — no sheet library.
import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { palette } from '../../lib/colors'

interface Props {
  visible: boolean
  /** One-sentence, collector-voiced reason voice isn't ready. */
  reason: string
  /** Numbered steps tailored to the user's device (OEM / Android version). */
  steps: string[]
  /** Primary: trigger the one-time on-device model download (Android 13+). */
  onSetUp: () => void
  /** Secondary: deep-link to the device voice-input settings. */
  onOpenSettings: () => void
  /** Re-attempt voice now (after the user finished setup). */
  onTryAgain: () => void
  /** Dismiss and let the user type — the text field is already on screen. */
  onTypeInstead: () => void
  /** Whether to show the settings deep-link button (Android only). */
  canOpenSettings: boolean
  /** THROWAWAY diagnostic readout — remove with VOICE_DIAG before wider rollout. */
  diag?: string | null
}

export function VoiceSetupSheet({
  visible, reason, steps, onSetUp, onOpenSettings, onTryAgain, onTypeInstead, canOpenSettings, diag,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onTypeInstead}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onTypeInstead}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="mic-outline" size={22} color={palette.green} />
                <Text style={styles.title}>Turn on your phone’s voice</Text>
              </View>
              <TouchableOpacity onPress={onTypeInstead} hitSlop={12} accessibilityLabel="Close">
                <Text style={styles.doneText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.reason}>{reason}</Text>

              {steps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.primaryBtn} onPress={onSetUp} accessibilityRole="button">
                <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Set up voice</Text>
              </TouchableOpacity>

              {canOpenSettings && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenSettings} accessibilityRole="button">
                  <Ionicons name="settings-outline" size={18} color={palette.ink} />
                  <Text style={styles.secondaryBtnText}>Open settings</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.tertiaryBtn} onPress={onTryAgain} accessibilityRole="button">
                <Text style={styles.tertiaryBtnText}>I’ve done this — try voice again</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.typeInstead} onPress={onTypeInstead} accessibilityRole="button">
                <Text style={styles.typeInsteadText}>Type instead</Text>
              </TouchableOpacity>

              {diag ? (
                <View style={styles.diagBox}>
                  <Text style={styles.diagLabel}>voice-diag (temporary)</Text>
                  <Text style={styles.diagText}>{diag}</Text>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 8, maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd', marginTop: 8, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0ece3',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 },
  title: { fontSize: 17, fontWeight: '700', color: palette.ink, flex: 1 },
  doneText: { fontSize: 15, color: palette.muted, fontWeight: '600' },
  body: { paddingHorizontal: 20 },
  bodyContent: { paddingTop: 16, paddingBottom: 8 },
  reason: { fontSize: 14, color: palette.ink, lineHeight: 20, marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#f0ece3',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: palette.ink },
  stepText: { flex: 1, fontSize: 14, color: palette.ink, lineHeight: 20 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: palette.green, borderRadius: 10, padding: 14, marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: palette.hairline, borderRadius: 10, padding: 13, marginTop: 10,
  },
  secondaryBtnText: { color: palette.ink, fontWeight: '600', fontSize: 15 },
  tertiaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  tertiaryBtnText: { color: palette.green, fontWeight: '600', fontSize: 14 },
  typeInstead: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  typeInsteadText: { color: palette.muted, fontSize: 14, textDecorationLine: 'underline' },
  diagBox: {
    marginTop: 12, padding: 10, borderRadius: 8,
    backgroundColor: '#faf7f0', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.hairline,
  },
  diagLabel: { fontSize: 10, fontWeight: '700', color: palette.red, marginBottom: 4 },
  diagText: { fontSize: 10, color: palette.muted, fontFamily: 'monospace' },
})
