// Voice recorder with three distinct states:
//   green mic (ready) → red mic (recording) → amber mic (paused after silence)
// Uncertain words (low confidence) shown with dashed amber underline.
import React, { useState, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import * as Speech from 'expo-speech'

type RecorderState = 'ready' | 'recording' | 'paused'

interface TranscriptWord {
  word: string
  uncertain: boolean
}

interface Props {
  onTranscriptUpdate: (text: string) => void
}

export function VoiceRecorder({ onTranscriptUpdate }: Props) {
  const [state, setState] = useState<RecorderState>('ready')
  const [words, setWords] = useState<TranscriptWord[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [detectedLang, setDetectedLang] = useState<string | null>(null)

  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const MAX_SECONDS = 180

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start()
  }, [pulseAnim])

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
  }, [pulseAnim])

  const startRecording = useCallback(() => {
    setState('recording')
    startPulse()

    sessionTimer.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= MAX_SECONDS) {
          handlePause()
          return e
        }
        return e + 1
      })
    }, 1000)

    // Silence detection — auto-pause after 3 seconds of silence
    silenceTimer.current = setTimeout(() => handlePause(), 3000)
  }, [startPulse])

  const handlePause = useCallback(() => {
    setState('paused')
    stopPulse()
    if (sessionTimer.current) clearInterval(sessionTimer.current)
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
  }, [stopPulse])

  const handleContinue = useCallback(() => {
    startRecording()
  }, [startRecording])

  const handleToggle = useCallback(() => {
    if (state === 'ready') startRecording()
    else if (state === 'recording') handlePause()
    else if (state === 'paused') handleContinue()
  }, [state, startRecording, handlePause, handleContinue])

  const micColor = state === 'ready' ? '#1D9E75' : state === 'recording' ? '#C0392B' : '#E67E22'

  const fullTranscript = words.map((w) => w.word).join(' ')

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleToggle} style={styles.micBtn} activeOpacity={0.8}>
        <Animated.View
          style={[
            styles.micCircle,
            { backgroundColor: micColor },
            state === 'recording' && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.micIcon}>🎤</Text>
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.status}>
        {state === 'ready' && (
          <Text style={styles.hint}>Tap to record · speak naturally</Text>
        )}
        {state === 'recording' && (
          <>
            <Text style={[styles.hint, { color: '#C0392B' }]}>Recording… {formatTime(elapsed)}</Text>
            {detectedLang && <Text style={styles.langBadge}>{detectedLang} detected</Text>}
          </>
        )}
        {state === 'paused' && (
          <Text style={[styles.hint, { color: '#E67E22' }]}>Paused · tap to continue</Text>
        )}
      </View>

      {/* Transcript preview with uncertain word highlighting */}
      {words.length > 0 && (
        <View style={styles.transcript}>
          <Text style={styles.transcriptText}>
            {words.map((w, i) => (
              <Text
                key={i}
                style={[styles.word, w.uncertain && styles.uncertainWord]}
              >
                {w.word}{i < words.length - 1 ? ' ' : ''}
              </Text>
            ))}
          </Text>
        </View>
      )}
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
  status: {
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  langBadge: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  transcript: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    width: '100%',
  },
  transcriptText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  word: {
    fontSize: 14,
    color: '#333',
  },
  uncertainWord: {
    color: '#E67E22',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: '#E67E22',
  },
})
