// On-device voice transcription for journal entries.
//
// PRIVACY (structural, not a comment-only promise):
//   - `requiresOnDeviceRecognition: true` is forced on every start(), so the
//     OS transcribes on the device and audio is never sent to Apple/Google
//     cloud speech services.
//   - No `recordingOptions` are passed to start(). expo-speech-recognition only
//     writes an audio file when `recordingOptions.persist` is set, so NO audio
//     buffer is ever created or stored — there is nothing to delete afterward.
//   - If the device cannot do on-device recognition, we surface an error and
//     let the user type instead. We never silently fall back to cloud
//     recognition, because that would send audio off-device.
//
// DURATION (BLD-33): hard cap at MAX_RECORDING_MS on a single recording
// session. A JS timer started alongside ExpoSpeechRecognitionModule.start()
// calls stop() at the cap; the resulting 'end' event flushes the timer in
// the normal cleanup. Cleared on user stop, on 'end', on 'error', and on
// unmount alongside the existing .abort().
//
// CONTINUOUS MODE (BLD-33): switched from continuous:false to continuous:true.
// continuous:false ends recognition at the first natural pause, which would
// truncate a reflective ~30s entry the moment the user breathes. continuous:
// true keeps the engine listening across pauses; multiple final-result
// events may fire across the session, and the parent appends each via
// onTranscriptUpdate. The hard timer caps the session regardless. Trade-off:
// utterances are no longer auto-finalized on silence; the user (or the timer)
// must explicitly stop.
//
// SCOPE: minimum-viable behavior — a single mic toggle plus a tiny remaining-
// seconds indicator. Three-state UI, waveform, paused state, and language
// detection remain deferred.
//
// LIBRARY: expo-speech-recognition (jamsch), installed as the `sdk-54` dist-tag.
// Chosen over @react-native-voice/voice, which is unmaintained (v3.2.4, ~4 years
// old) with no Expo SDK 54 / RN 0.81 / New Architecture support.
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'
import { palette } from '../../lib/colors'

interface Props {
  onTranscriptUpdate: (text: string) => void
}

const LOCALE = 'en-US'
const MAX_RECORDING_MS = 30_000
const TICK_MS = 250 // remaining-seconds display refresh

export function VoiceRecorder({ onTranscriptUpdate }: Props) {
  const [recording, setRecording] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [remainingMs, setRemainingMs] = useState(MAX_RECORDING_MS)
  const recordingRef = useRef(false)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  // Cumulative ms used across all start/stop sessions of THIS recorder
  // instance. The 30s cap is a shared budget: speak 10s, stop, start again,
  // and you get the remaining ~20s — each session appends to the journal —
  // until the budget is exhausted. Resets when the recorder unmounts (a
  // fresh journal-entry editing session).
  const consumedMsRef = useRef<number>(0)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  // Centralized timer cleanup. Safe to call multiple times; double-fire on
  // (timer-fired-then-end-fired) is the expected path.
  const clearTimers = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }, [])

  // End the current session: bank its elapsed time against the budget (once),
  // stop the timers, and surface the remaining budget. startedAtRef is zeroed
  // so a following 'end'/'error' for the same session can't double-count.
  const finalizeSession = useCallback(() => {
    if (startedAtRef.current > 0) {
      const elapsed = Date.now() - startedAtRef.current
      consumedMsRef.current = Math.min(MAX_RECORDING_MS, consumedMsRef.current + elapsed)
      startedAtRef.current = 0
    }
    clearTimers()
    setRecording(false)
    setRemainingMs(Math.max(0, MAX_RECORDING_MS - consumedMsRef.current))
  }, [clearTimers])

  // Stop any in-flight recognition + flush timers if the component unmounts
  // mid-session.
  useEffect(() => {
    return () => {
      clearTimers()
      if (recordingRef.current) ExpoSpeechRecognitionModule.abort()
    }
  }, [clearTimers])

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return // interim results are ignored in the MVP
    const transcript = event.results?.[0]?.transcript?.trim()
    if (transcript) onTranscriptUpdate(transcript)
  })

  useSpeechRecognitionEvent('end', () => {
    finalizeSession()
  })

  useSpeechRecognitionEvent('error', (event) => {
    finalizeSession()
    if (event.error === 'no-speech') return // benign: user didn't speak
    Alert.alert('Voice entry', event.message || 'Transcription failed. You can type your entry instead.')
  })

  const start = useCallback(async () => {
    try {
      // Remaining shared budget for this entry. Stop here if it's spent.
      const budget = MAX_RECORDING_MS - consumedMsRef.current
      if (budget < 1000) {
        Alert.alert('Voice entry', "You've used the 30 seconds of voice for this entry. You can keep typing.")
        return
      }

      // On-device recognition is mandatory for the privacy commitment.
      if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
        Alert.alert(
          'Voice entry unavailable',
          'On-device transcription is not available on this device, so voice entry is disabled here. Please type your entry instead.'
        )
        return
      }

      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!perms.granted) {
        Alert.alert(
          'Permission needed',
          'Microphone and speech recognition permission are required for voice journal entries.'
        )
        return
      }

      // Android needs the offline language model present for on-device use.
      // No-op / not applicable on iOS. Non-fatal if it fails — start() will
      // raise a clear error below if the model truly is not usable.
      if (Platform.OS === 'android') {
        setPreparing(true)
        try {
          await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: LOCALE })
        } catch {
          // ignore — handled by the start() error path
        }
        setPreparing(false)
      }

      ExpoSpeechRecognitionModule.start({
        lang: LOCALE,
        interimResults: false,
        continuous: true,
        addsPunctuation: true,
        requiresOnDeviceRecognition: true, // audio never leaves the device
        // No recordingOptions => no audio file is written.
      })
      setRecording(true)
      startedAtRef.current = Date.now()
      setRemainingMs(budget)

      // Hard cap on the REMAINING budget (not a fresh 30s). The 'end' handler
      // banks the elapsed time + clears timers on a normal user-stop; this is
      // the safety net for "user keeps talking" past the budget.
      autoStopRef.current = setTimeout(() => {
        ExpoSpeechRecognitionModule.stop()
      }, budget)

      // Tick the visible countdown against the shared budget.
      tickRef.current = setInterval(() => {
        const used = consumedMsRef.current + (Date.now() - startedAtRef.current)
        setRemainingMs(Math.max(0, MAX_RECORDING_MS - used))
      }, TICK_MS)
    } catch (e) {
      setPreparing(false)
      finalizeSession()
      Alert.alert('Voice entry', e instanceof Error ? e.message : 'Could not start voice entry. You can type your entry instead.')
    }
  }, [finalizeSession])

  const stop = useCallback(() => {
    // Don't clear timers here — let 'end' clean up so we don't race the
    // engine's own teardown. .stop() will trigger the 'end' event.
    ExpoSpeechRecognitionModule.stop()
  }, [])

  const toggle = useCallback(() => {
    if (preparing) return
    if (recording) stop()
    else start()
  }, [preparing, recording, start, stop])

  const remainingSec = Math.ceil(remainingMs / 1000)
  // < 1s left can't start a session (matches the budget gate in start()).
  const exhausted = remainingMs < 1000
  const partial = !exhausted && remainingMs < MAX_RECORDING_MS

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={toggle}
        disabled={preparing || (!recording && exhausted)}
        style={[styles.micBtn, !recording && exhausted && { opacity: 0.5 }]}
        activeOpacity={0.8}
      >
        <View style={[styles.micCircle, { backgroundColor: recording ? '#C0392B' : palette.green }]}>
          <Text style={styles.micIcon}>🎤</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.hint}>
        {preparing
          ? 'Preparing offline voice…'
          : recording
            ? `Listening… ${remainingSec}s left · tap to stop`
            : exhausted
              ? 'Voice limit reached for this entry'
              : partial
                ? `Tap to continue · ${remainingSec}s left`
                : 'Tap to speak · up to 30s · transcribed on-device'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  micBtn: {
    marginBottom: 8,
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  micIcon: {
    fontSize: 28,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
})
