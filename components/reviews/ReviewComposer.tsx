// Public review capture — SEPARATE from the private journal, shown in the
// same area. Optional text + a required 1-5 rating, with the journal's
// on-device speech-to-text reused verbatim.
//
// LEAST-LIABILITY GATES (all fail closed):
//   * Hard-disable: if reviews are disabled for this stop (youth/education
//     institution), the composer renders nothing at all.
//   * 18+ self-attestation: the first time, a one-time gate blocks the
//     composer until the user affirms they are 18 or older. We store only an
//     "attested adult" timestamp — NO birthdate.
//   * Verified-visitor: enforced server-side; the composer is only mounted
//     where the viewer holds a stamp for the stop.
//
// ATTRIBUTION: before posting, the user is shown the exact public string
// (their display name) paired with the fixed "Verified visitor" label, so
// attribution is disclosed, not a surprise.
import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { VoiceRecorder } from '../journal/VoiceRecorder'
import { StarRating } from './StarRating'
import { palette } from '../../lib/colors'
import {
  hasAttestedAdult, attestAdult, reviewsEnabledForStop, getMyReview, submitStopReview,
} from '../../lib/reviews'

interface Props {
  stopId: string
  onSaved?: () => void
}

const MAX_BODY = 1000

export function ReviewComposer({ stopId, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)        // youth-institution hard-disable
  const [attested, setAttested] = useState(false)
  const [displayName, setDisplayName] = useState<string>('Verified visitor')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [showVoice, setShowVoice] = useState(false)
  const [editing, setEditing] = useState(false)        // already has a review
  const [saving, setSaving] = useState(false)
  const [attesting, setAttesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      const [allowed, didAttest, mine] = await Promise.all([
        reviewsEnabledForStop(stopId),
        hasAttestedAdult(),
        getMyReview(stopId),
      ])
      let name = 'Verified visitor'
      if (auth.user) {
        const { data: profile } = await supabase
          .from('profiles').select('display_name').eq('id', auth.user.id).single()
        if (profile?.display_name?.trim()) name = profile.display_name.trim()
      }
      if (cancelled) return
      setEnabled(allowed)
      setAttested(didAttest)
      setDisplayName(name)
      if (mine) {
        setEditing(true)
        setRating(mine.rating)
        setBody(mine.body ?? '')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [stopId])

  const onTranscript = useCallback((text: string) => {
    setBody((prev) => (prev ? `${prev} ${text}` : text).slice(0, MAX_BODY))
  }, [])

  const affirmAdult = useCallback(async () => {
    setAttesting(true)
    try {
      await attestAdult()
      setAttested(true)
    } catch (e) {
      Alert.alert('Reviews', e instanceof Error ? e.message : 'Could not record attestation.')
    } finally {
      setAttesting(false)
    }
  }, [])

  const save = useCallback(async () => {
    if (rating < 1) {
      Alert.alert('Reviews', 'Please choose a star rating before posting.')
      return
    }
    setSaving(true)
    try {
      await submitStopReview(stopId, rating, body)
      onSaved?.()
      Alert.alert('Review posted', 'Your review is now public on this stop.')
    } catch (e) {
      Alert.alert('Reviews', e instanceof Error ? e.message : 'Could not post your review.')
    } finally {
      setSaving(false)
    }
  }, [stopId, rating, body, onSaved])

  if (loading) {
    return (
      <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>
    )
  }

  // Hard-disable: no public review surface at all on youth/education stops.
  if (!enabled) return null

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Public review</Text>
      <Text style={styles.subhead}>
        Separate from your private journal. Reviews are public to other collectors.
      </Text>

      {!attested ? (
        // 18+ self-attestation gate — fail closed.
        <View style={styles.gate}>
          <Text style={styles.gateText}>
            Reviews are public. You must be 18 or older to post.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, attesting && styles.btnDisabled]}
            onPress={affirmAdult}
            disabled={attesting}
          >
            <Text style={styles.primaryBtnText}>
              {attesting ? 'One moment…' : 'I am 18 or older'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Your rating</Text>
          <StarRating value={rating} onChange={setRating} />

          <Text style={styles.label}>Your review (optional)</Text>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MAX_BODY))}
            placeholder="What should other collectors know about this stop?"
            placeholderTextColor={palette.muted}
            multiline
            maxLength={MAX_BODY}
          />

          <TouchableOpacity onPress={() => setShowVoice((v) => !v)} hitSlop={8}>
            <Text style={styles.voiceToggle}>
              {showVoice ? 'Hide voice entry' : 'Use voice instead'}
            </Text>
          </TouchableOpacity>
          {showVoice && <VoiceRecorder onTranscriptUpdate={onTranscript} />}

          <Text style={styles.attribution}>
            This review will be shown publicly as “{displayName}” (Verified visitor).
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Posting…' : editing ? 'Update review' : 'Post review'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  loading: { padding: 24, alignItems: 'center' },
  heading: { fontSize: 16, fontWeight: '600', color: palette.ink },
  subhead: { fontSize: 13, color: palette.muted, marginTop: 2, marginBottom: 12 },
  gate: {
    backgroundColor: palette.cream,
    borderRadius: 8,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  gateText: { fontSize: 14, color: palette.ink, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: palette.ink, marginTop: 14, marginBottom: 6 },
  input: {
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    borderRadius: 6,
    padding: 10,
    fontSize: 15,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  voiceToggle: { color: palette.blue, fontSize: 13, marginTop: 10 },
  attribution: { fontSize: 12, color: palette.muted, marginTop: 14, fontStyle: 'italic' },
  primaryBtn: {
    backgroundColor: palette.green,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: palette.paper, fontSize: 15, fontWeight: '600' },
})
