// On-device voice transcription for journal entries.
//
// PRIVACY (structural, not a comment-only promise):
//   - `requiresOnDeviceRecognition: true` is forced on every start(), so the
//     OS transcribes on the device and audio is never sent to Apple/Google
//     cloud speech services.
//   - No `recordingOptions` are passed to start(). expo-speech-recognition only
//     writes an audio file when `recordingOptions.persist` is set, so NO audio
//     buffer is ever created or stored — there is nothing to delete afterward.
//   - If the device cannot do on-device recognition, we surface the guided
//     setup sheet (Android) or an honest message (iOS) and let the user type.
//     We never silently fall back to cloud recognition — that would send audio
//     off-device.
//
// READINESS (voice-setup follow-up): we start OPTIMISTICALLY rather than
// pre-gating on getSupportedLocales — that check reports NO installed locales
// on Android 13+ even when voice works, which nagged ready phones. Instead we
// call start(); if the on-device model genuinely isn't provisioned, the engine
// emits an error that routes into VoiceSetupSheet, a guided path to turn voice
// on. Ready phones just start and never see a prompt.
//
// DURATION (BLD-33): hard cap at MAX_RECORDING_MS on a single recording
// session. A JS timer started alongside ExpoSpeechRecognitionModule.start()
// calls stop() at the cap; the resulting 'end' event flushes the timer in
// the normal cleanup. Cleared on user stop, on 'end', on 'error', and on
// unmount alongside the existing .abort().
//
// CONTINUOUS MODE (BLD-33): continuous:true keeps the engine listening across
// pauses; multiple final-result events may fire and the parent appends each via
// onTranscriptUpdate. The hard timer caps the session regardless.
//
// LIBRARY: expo-speech-recognition (jamsch), installed as the `sdk-54` dist-tag.
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Linking, AppState } from 'react-native'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'
import { palette } from '../../lib/colors'
import { VoiceSetupSheet } from './VoiceSetupSheet'

interface Props {
  onTranscriptUpdate: (text: string) => void
}

// THROWAWAY diagnostic — while we confirm the real on-device-voice state across
// devices, the setup sheet shows a compact signal readout and we log it under
// [voice-diag]. Flip to false (and delete collectVoiceDiag + the sheet's diag
// footer) before widening the beta.
const VOICE_DIAG = true

const LOCALE = 'en-US'
const MAX_RECORDING_MS = 30_000
const TICK_MS = 250 // remaining-seconds display refresh
// On-device recognition (com.google.android.as) is what keeps audio on the
// phone; getSupportedLocales reports which language packs are installed there.
const ON_DEVICE_PACKAGE = 'com.google.android.as'

// Map a speech-recognition error CODE to a stage-specific, honest message. Used
// for the non-setup failure classes (mic, network, permission) and on iOS,
// where the Android setup sheet doesn't apply. Setup-class failures on Android
// route to VoiceSetupSheet instead.
function voiceErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech-recognition permission is needed for voice entries.'
    case 'audio-capture':
      return 'The microphone isn’t available right now. You can type your entry instead.'
    case 'network':
      return 'Voice needs a connection right now. You can type your entry instead.'
    default:
      return 'Voice isn’t available right now. You can type your entry instead.'
  }
}

// Numbered, collector-voiced setup steps tailored to the device. Samsung's
// default recognizer is often Bixby (which can't return on-device results), so
// its path differs from Pixel/AOSP. Below Android 13 there's no one-tap
// offline-model download at all.
function buildSetupSteps(recognizerPkg: string, apiLevel: number): string[] {
  if (apiLevel > 0 && apiLevel < 33) {
    return [
      'Open settings → Voice input, and turn on Google’s on-device voice for English.',
      'If your phone doesn’t offer on-device voice, you can type your entry instead.',
    ]
  }
  if (/samsung|bixby/i.test(recognizerPkg)) {
    return [
      'Tap “Set up voice” below and confirm the English download if your phone offers it.',
      'If it doesn’t: Open settings → Voice input → choose Google (Speech Services by Google), then turn on offline / on-device English.',
      'Come back here and tap “try voice again”.',
    ]
  }
  return [
    'Tap “Set up voice” below, then confirm the English download when your phone asks.',
    'If nothing appears: Open settings → turn on on-device (offline) voice recognition for English.',
    'Come back here and tap “try voice again”.',
  ]
}

// THROWAWAY: gather the device's recognition signals into one compact string so
// we can see, from a real device, whether the block is a missing offline model,
// a Bixby-default recognizer, etc. Remove alongside VOICE_DIAG.
async function collectVoiceDiag(errCode?: string): Promise<string> {
  const M = ExpoSpeechRecognitionModule
  const parts: string[] = []
  const push = (k: string, fn: () => unknown) => {
    try { parts.push(`${k}=${String(fn())}`) } catch { parts.push(`${k}=ERR`) }
  }
  push('plat', () => `${Platform.OS}:${Platform.Version}`)
  push('onDevice', () => M.supportsOnDeviceRecognition())
  push('available', () => M.isRecognitionAvailable())
  push('recording', () => M.supportsRecording())
  push('services', () => M.getSpeechRecognitionServices().join('|'))
  push('default', () => M.getDefaultRecognitionService().packageName)
  push('assistant', () => M.getAssistantService().packageName)
  try {
    const { locales, installedLocales } = await M.getSupportedLocales({
      androidRecognitionServicePackage: ON_DEVICE_PACKAGE,
    })
    parts.push(`locales=${locales.length}`)
    parts.push(`installed=${installedLocales.join(',') || '-'}`)
  } catch { parts.push('locales=ERR') }
  if (errCode) parts.push(`err=${errCode}`)
  const text = parts.join('\n')
  console.log('[voice-diag]\n' + text)
  return text
}

export function VoiceRecorder({ onTranscriptUpdate }: Props) {
  const [recording, setRecording] = useState(false)
  const [remainingMs, setRemainingMs] = useState(MAX_RECORDING_MS)
  const [setupVisible, setSetupVisible] = useState(false)
  const [setupSteps, setSetupSteps] = useState<string[]>([])
  const [diagText, setDiagText] = useState<string | null>(null)
  const recordingRef = useRef(false)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  // Cumulative ms used across all start/stop sessions of THIS recorder
  // instance — the 30s cap is a shared budget. Resets on unmount.
  const consumedMsRef = useRef<number>(0)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  const clearTimers = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }, [])

  // End the current session: bank its elapsed time against the budget (once),
  // stop the timers, and surface the remaining budget.
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

  // Open the guided setup sheet (Android only — iOS on-device recognition is
  // built in). Tailors the steps to the default recognizer + Android version,
  // and gathers the throwaway diagnostic.
  const showSetup = useCallback(async (errCode?: string): Promise<boolean> => {
    if (Platform.OS !== 'android') return false
    let recognizer = ''
    try { recognizer = ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName } catch { /* ignore */ }
    const apiLevel = typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10) || 0
    setSetupSteps(buildSetupSteps(recognizer, apiLevel))
    if (VOICE_DIAG) {
      try { setDiagText(await collectVoiceDiag(errCode)) } catch { setDiagText(null) }
    }
    setSetupVisible(true)
    return true
  }, [])

  // Stop any in-flight recognition + flush timers on unmount.
  useEffect(() => {
    return () => {
      clearTimers()
      if (recordingRef.current) ExpoSpeechRecognitionModule.abort()
    }
  }, [clearTimers])

  // While the setup sheet is up, re-check on foreground: if the offline English
  // model now reports installed, setup succeeded — clear the sheet automatically
  // so returning from the system download / Settings just works.
  useEffect(() => {
    if (!setupVisible) return
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      ExpoSpeechRecognitionModule.getSupportedLocales({ androidRecognitionServicePackage: ON_DEVICE_PACKAGE })
        .then(({ installedLocales }) => {
          if ((installedLocales ?? []).some((l) => l.toLowerCase().replace('_', '-').startsWith('en'))) {
            setSetupVisible(false)
          }
        })
        .catch(() => { /* can't confirm — leave the sheet up; user can retry */ })
    })
    return () => sub.remove()
  }, [setupVisible])

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
    // benign: user didn't speak ('no-speech'), or we stopped/aborted the
    // session ourselves ('aborted' fires on stop()/unmount) — no alert.
    if (event.error === 'no-speech' || event.error === 'aborted') return
    console.error('[voice] recognition error', { code: event.error, message: event.message })
    // Setup-class failures on Android (model not provisioned, service can't do
    // on-device, generic client error) → guided setup sheet, not a dead-end.
    // Mic / network / permission keep their specific message.
    const nonSetup = ['audio-capture', 'network', 'not-allowed']
    if (Platform.OS === 'android' && !nonSetup.includes(event.error ?? '')) {
      void showSetup(event.error)
      return
    }
    Alert.alert('Voice entry', voiceErrorMessage(event.error))
  })

  const start = useCallback(async () => {
    try {
      // Remaining shared budget for this entry. Stop here if it's spent.
      const budget = MAX_RECORDING_MS - consumedMsRef.current
      if (budget < 1000) {
        Alert.alert('Voice entry', "You've used the 30 seconds of voice for this entry. You can keep typing.")
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

      // iOS: on-device recognition is built in; if the device genuinely can't,
      // say so honestly. Android: DON'T pre-gate — start optimistically so ready
      // phones never see a prompt; a not-provisioned model surfaces as an error
      // that routes into the setup sheet (see the 'error' handler).
      if (Platform.OS !== 'android' && !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
        Alert.alert(
          'Voice entry unavailable',
          'On-device transcription isn’t available on this device. Please type your entry instead.'
        )
        return
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

      // Hard cap on the REMAINING budget (not a fresh 30s).
      autoStopRef.current = setTimeout(() => {
        ExpoSpeechRecognitionModule.stop()
      }, budget)

      // Tick the visible countdown against the shared budget.
      tickRef.current = setInterval(() => {
        const used = consumedMsRef.current + (Date.now() - startedAtRef.current)
        setRemainingMs(Math.max(0, MAX_RECORDING_MS - used))
      }, TICK_MS)
    } catch (e) {
      finalizeSession()
      // A synchronous throw from start() (rather than an async error event):
      // Android → guided setup sheet; iOS → honest message.
      if (Platform.OS === 'android') {
        void showSetup(e instanceof Error ? e.message : undefined)
        return
      }
      Alert.alert('Voice entry', e instanceof Error ? e.message : 'Could not start voice entry. You can type your entry instead.')
    }
  }, [finalizeSession, showSetup])

  const stop = useCallback(() => {
    // Don't clear timers here — let 'end' clean up so we don't race the
    // engine's own teardown. .stop() will trigger the 'end' event.
    ExpoSpeechRecognitionModule.stop()
  }, [])

  const toggle = useCallback(() => {
    if (recording) stop()
    else start()
  }, [recording, start, stop])

  // --- Setup-sheet actions ---
  // Primary: trigger the one-time on-device model download (Android 13+). On 13
  // this opens the system download dialog; on 14+ it downloads directly. Keep
  // the sheet up — the foreground re-check clears it when the model lands.
  const handleSetUp = useCallback(async () => {
    try { await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: LOCALE }) }
    catch { /* ignore — the user can still use Open settings */ }
  }, [])

  // Secondary: deep-link to voice-input settings, falling back to top-level
  // Settings if the specific screen isn't present on this OEM/version.
  const handleOpenSettings = useCallback(async () => {
    try { await Linking.sendIntent('android.settings.VOICE_INPUT_SETTINGS') }
    catch {
      try { await Linking.sendIntent('android.settings.SETTINGS') } catch { /* no-op */ }
    }
  }, [])

  const handleTryAgain = useCallback(() => { setSetupVisible(false); void start() }, [start])
  const handleTypeInstead = useCallback(() => { setSetupVisible(false) }, [])

  const remainingSec = Math.ceil(remainingMs / 1000)
  const exhausted = remainingMs < 1000
  const partial = !exhausted && remainingMs < MAX_RECORDING_MS

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={toggle}
        disabled={!recording && exhausted}
        style={[styles.micBtn, !recording && exhausted && { opacity: 0.5 }]}
        activeOpacity={0.8}
      >
        <View style={[styles.micCircle, { backgroundColor: recording ? palette.red : palette.green }]}>
          <Text style={styles.micIcon}>🎤</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.hint}>
        {recording
          ? `Listening… ${remainingSec}s left · tap to stop`
          : exhausted
            ? 'Voice limit reached for this entry'
            : partial
              ? `Tap to continue · ${remainingSec}s left`
              : 'Tap to speak · up to 30s · transcribed on-device'}
      </Text>

      <VoiceSetupSheet
        visible={setupVisible}
        reason="okuji types out what you say right on your phone, so your words never leave it. Your phone just needs its on-device voice switched on first — a one-time setup."
        steps={setupSteps}
        onSetUp={handleSetUp}
        onOpenSettings={handleOpenSettings}
        onTryAgain={handleTryAgain}
        onTypeInstead={handleTypeInstead}
        canOpenSettings={Platform.OS === 'android'}
        diag={VOICE_DIAG ? diagText : null}
      />
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
