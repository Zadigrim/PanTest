// Public reviews display for a stop — the outward-facing surface other
// collectors see. Shows the aggregate average (excluding hidden reviews,
// computed server-side) and the list of reviews with minimal attribution.
//
// MODERATION (KI-07 reuse):
//   * Any signed-in viewer can Report a review (one report surfaces it).
//   * A platform admin sees inline Hide / Unhide controls; hidden reviews
//     are excluded from non-admin reads (RLS) and from the average (RPC).
//   * The author of a hidden review sees it marked "hidden by moderators"
//     rather than vanishing.
import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { StarRating } from './StarRating'
import { palette } from '../../lib/colors'
import type { StopReview, StopReviewSummary } from '../../types'
import {
  listStopReviews, getStopReviewSummary, reportStopReview, setReviewHidden, isPlatformAdmin,
} from '../../lib/reviews'

interface Props {
  stopId: string
  refreshKey?: number // bump to force a reload (e.g. after posting)
}

export function StopReviews({ stopId, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<StopReviewSummary>({ avg_rating: null, review_count: 0 })
  const [reviews, setReviews] = useState<StopReview[]>([])
  const [admin, setAdmin] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    setMyId(auth.user?.id ?? null)
    const [sum, list, isAdmin] = await Promise.all([
      getStopReviewSummary(stopId),
      listStopReviews(stopId),
      isPlatformAdmin(),
    ])
    setSummary(sum)
    setReviews(list)
    setAdmin(isAdmin)
    setLoading(false)
  }, [stopId])

  useEffect(() => { load() }, [load, refreshKey])

  const onReport = useCallback((id: string) => {
    Alert.alert('Report review', 'Report this review to moderators?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportStopReview(id)
            Alert.alert('Reported', 'Thanks — moderators will take a look.')
          } catch (e) {
            Alert.alert('Reviews', e instanceof Error ? e.message : 'Could not report.')
          }
        },
      },
    ])
  }, [])

  const onToggleHidden = useCallback(async (review: StopReview) => {
    try {
      await setReviewHidden(review.id, review.hidden_at == null)
      await load()
    } catch (e) {
      Alert.alert('Reviews', e instanceof Error ? e.message : 'Could not update.')
    }
  }, [load])

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.heading}>Reviews</Text>
        {summary.review_count > 0 ? (
          <View style={styles.summaryRight}>
            <StarRating value={summary.avg_rating ?? 0} size={16} />
            <Text style={styles.summaryText}>
              {summary.avg_rating?.toFixed(1)} · {summary.review_count}
              {summary.review_count === 1 ? ' review' : ' reviews'}
            </Text>
          </View>
        ) : (
          <Text style={styles.summaryText}>No reviews yet</Text>
        )}
      </View>

      {reviews.map((r) => {
        const hidden = r.hidden_at != null
        const mine = r.author_id === myId
        return (
          <View key={r.id} style={styles.review}>
            <View style={styles.reviewHead}>
              <StarRating value={r.rating} size={14} />
              <Text style={styles.attribution}>{r.attribution} · Verified visitor</Text>
            </View>
            {hidden && (
              <Text style={styles.hiddenNote}>
                {mine ? 'Your review was hidden by moderators.' : 'Hidden by moderators.'}
              </Text>
            )}
            {r.body ? <Text style={styles.body}>{r.body}</Text> : null}
            <View style={styles.actions}>
              {!mine && (
                <TouchableOpacity onPress={() => onReport(r.id)} hitSlop={6}>
                  <Text style={styles.report}>Report</Text>
                </TouchableOpacity>
              )}
              {admin && (
                <TouchableOpacity onPress={() => onToggleHidden(r)} hitSlop={6}>
                  <Text style={styles.adminAction}>{hidden ? 'Unhide' : 'Hide'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  loading: { padding: 24, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontSize: 16, fontWeight: '600', color: palette.ink },
  summaryText: { fontSize: 13, color: palette.muted },
  review: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attribution: { fontSize: 12, color: palette.muted },
  hiddenNote: { fontSize: 12, color: palette.red, marginTop: 4, fontStyle: 'italic' },
  body: { fontSize: 15, color: palette.ink, marginTop: 6, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  report: { fontSize: 12, color: palette.muted },
  adminAction: { fontSize: 12, color: palette.red, fontWeight: '600' },
})
