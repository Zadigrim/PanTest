// Journal entry screen for a specific stamp.
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { JournalEntry } from '../../components/journal/JournalEntry'
import type { JournalEntry as JournalEntryType } from '../../types'
import { palette } from '../../lib/colors'

export default function JournalScreen() {
  const { stampId } = useLocalSearchParams<{ stampId: string }>()
  const [userId, setUserId] = useState<string | null>(null)
  const [existing, setExisting] = useState<JournalEntryType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('stamp_id', stampId)
        .single()

      setExisting(data)
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
    <JournalEntry
      stampId={stampId}
      userId={userId}
      existingBody={existing?.body ?? ''}
      existingMood={existing?.mood_rating}
      existingPhotos={existing?.photo_urls ?? []}
      onSaved={() => router.back()}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
