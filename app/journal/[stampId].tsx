// Journal entry screen for a specific stamp. The journal is PRIVATE and
// stays that way — the public review is a separate record, reached via the
// link below (which carries the stamp's stop_id).
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { JournalEntry } from '../../components/journal/JournalEntry'
import type { JournalEntry as JournalEntryType } from '../../types'
import { palette } from '../../lib/colors'

export default function JournalScreen() {
  const { stampId } = useLocalSearchParams<{ stampId: string }>()
  const [userId, setUserId] = useState<string | null>(null)
  const [existing, setExisting] = useState<JournalEntryType | null>(null)
  const [stopId, setStopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const [{ data: entry }, { data: stamp }] = await Promise.all([
        supabase.from('journal_entries').select('*').eq('stamp_id', stampId).single(),
        supabase.from('stamps').select('stop_id').eq('id', stampId).single(),
      ])

      setExisting(entry)
      setStopId(stamp?.stop_id ?? null)
      setLoading(false)
    }
    load()
  }, [stampId])

  if (loading || !userId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.journal}>
        <JournalEntry
          stampId={stampId}
          userId={userId}
          existingEntryId={existing?.id ?? null}
          existingBody={existing?.body ?? ''}
          existingMood={existing?.mood_rating}
          existingPhotos={existing?.photo_urls ?? []}
          onSaved={() => router.back()}
        />
      </View>
      {stopId && (
        <TouchableOpacity
          style={styles.reviewLink}
          onPress={() => router.push(`/stop/${stopId}`)}
          accessibilityRole="button"
        >
          <Text style={styles.reviewLinkText}>Leave a public review for this stop</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  journal: { flex: 1 },
  reviewLink: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  reviewLinkText: { fontSize: 14, color: palette.blue, fontWeight: '600' },
})
