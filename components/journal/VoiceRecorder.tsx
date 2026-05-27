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
// SCOPE: minimum-viable behavior — a single mic toggle that returns the final
// transcript via `onTranscriptUpdate`. The three-state mic UI (green/red/amber),
// live waveform, paused state, and language detection are intentionally deferred
// to a follow-up.
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

export function VoiceRecorder({ onTranscriptUpdate }: Props) {
  const [recording, setRecording] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const recordingRef = useRef(false)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  // Stop any in-flight recognition if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      if (recordingRef.current) ExpoSpeechRecognitionModule.abort()
    }
  }, [])

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return // interim results are ignored in the MVP
    const transcript = event.results?.[0]?.transcript?.trim()
    if (transcript) onTranscriptUpdate(transcript)
  })

  useSpeechRecognitionEvent('end', () => setRecording(false))

  useSpeechRecognitionEvent('error', (event) => {
    setRecording(false)
    if (event.error === 'no-speech') return // benign: user didn't speak
    Alert.alert('Voice entry', event.message || 'Transcription failed. You can type your entry instead.')
  })

  const start = useCallback(async () => {
    try {
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
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: true, // audio never leaves the device
        // No recordingOptions => no audio file is written.
      })
      setRecording(true)
    } catch (e) {
      setPreparing(false)
      setRecording(false)
      Alert.alert('Voice entry', e instanceof Error ? e.message : 'Could not start voice entry. You can type your entry instead.')
    }
  }, [])

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop()
  }, [])

  const toggle = useCallback(() => {
    if (preparing) return
    if (recording) stop()
    else start()
  }, [preparing, recording, start, stop])

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} disabled={preparing} style={styles.micBtn} activeOpacity={0.8}>
        <View style={[styles.micCircle, { backgroundColor: recording ? '#C0392B' : palette.green }]}>
          <Text style={styles.micIcon}>🎤</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.hint}>
        {preparing
          ? 'Preparing offline voice…'
          : recording
            ? 'Listening… tap to stop'
            : 'Tap to speak · transcribed on-device'}
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
