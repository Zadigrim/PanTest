// Public reviews surface for a stop — the outward-facing record other
// collectors see, kept deliberately separate from the private journal
// (which lives in the post-stamp sheet / journal screen and never appears
// here). Verified visitors who have attested 18+ get the composer; everyone
// authenticated sees the average + reviews. Youth/education stops render no
// composer (hard-disable, enforced server-side and reflected in the UI).
import React, { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ReviewComposer } from '../../components/reviews/ReviewComposer'
import { StopReviews } from '../../components/reviews/StopReviews'
import { palette } from '../../lib/colors'

export default function StopReviewsScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>()
  const [refreshKey, setRefreshKey] = useState(0)

  if (!stopId) return null

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ReviewComposer stopId={stopId} onSaved={() => setRefreshKey((k) => k + 1)} />
      <StopReviews stopId={stopId} refreshKey={refreshKey} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: { paddingBottom: 48 },
})
