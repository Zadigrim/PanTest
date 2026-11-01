// Collection detail — a curated series of passports with collection-level
// reward badges (migration 111). Read-only on mobile: collections are built
// and published from okujiKobo. Collectors see progress + the reward ladder.
import React from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useCollection, type MemberStatus } from '../../hooks/useCollection'
import { palette } from '../../lib/colors'

const STATUS_LABEL: Record<MemberStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}
const STATUS_COLOR: Record<MemberStatus, string> = {
  not_started: palette.muted,
  in_progress: palette.blue,
  completed: palette.green,
}

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading } = useCollection(id)

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Collection' }} />
        <ActivityIndicator color={palette.accent} />
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Collection' }} />
        <Text style={styles.empty}>This collection isn’t available.</Text>
      </View>
    )
  }

  const { collection, members, rewards, done, total } = data
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: collection.title }} />

      {/* Header */}
      <View style={styles.header}>
        {collection.edition_label ? (
          <Text style={styles.edition}>{collection.edition_label}</Text>
        ) : null}
        <Text style={styles.title}>{collection.title}</Text>
        {collection.subtitle ? <Text style={styles.subtitle}>{collection.subtitle}</Text> : null}
      </View>

      {collection.description ? (
        <Text style={styles.description}>{collection.description}</Text>
      ) : null}

      {/* Progress */}
      {total > 0 && (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{done} of {total} completed</Text>
        </View>
      )}

      {/* Reward ladder */}
      {rewards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REWARDS</Text>
          {rewards.map((r) => {
            const target = r.kind === 'all' ? total : (r.required_count ?? 0)
            const progressText = r.kind === 'all'
              ? 'Complete every passport'
              : `Complete ${r.required_count} passport${r.required_count === 1 ? '' : 's'}`
            return (
              <View key={r.id} style={[styles.rewardRow, r.earned && styles.rewardRowEarned]}>
                <View style={[styles.rewardDot, { backgroundColor: r.earned ? palette.accent : palette.hairline }]} />
                <View style={styles.rewardText}>
                  <Text style={styles.rewardTitle}>{r.title}</Text>
                  <Text style={styles.rewardDesc}>{r.description ?? progressText}</Text>
                </View>
                <Text style={[styles.rewardStatus, { color: r.earned ? palette.accent : palette.muted }]}>
                  {r.earned ? 'Earned' : (total > 0 && target > 0 ? `${Math.min(done, target)}/${target}` : '')}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PASSPORTS</Text>
        {members.length === 0 ? (
          <Text style={styles.empty}>No passports in this collection yet.</Text>
        ) : members.map((m) => (
          <TouchableOpacity
            key={m.passport.id}
            style={styles.memberRow}
            activeOpacity={0.85}
            onPress={() => router.push(`/passport/${m.passport.id}`)}
          >
            <View style={[styles.thumb, { backgroundColor: m.passport.cover_bg_color || palette.navy }]}>
              {m.passport.cover_thumbnail ? (
                <Image source={{ uri: m.passport.cover_thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={styles.thumbEmblem}>{m.passport.cover_emblem ?? '🧭'}</Text>
              )}
            </View>
            <View style={styles.memberText}>
              <Text style={styles.memberTitle} numberOfLines={2}>{m.passport.title}</Text>
              <Text style={[styles.memberStatus, { color: STATUS_COLOR[m.status] }]}>
                {STATUS_LABEL[m.status]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.paper },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: palette.paper },
  empty: { color: palette.muted, fontStyle: 'italic' },

  header: { marginBottom: 14 },
  edition: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: palette.accent, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontFamily: 'serif', fontSize: 24, fontWeight: '700', color: palette.ink, lineHeight: 30 },
  subtitle: { fontSize: 14, color: palette.muted, marginTop: 4 },
  description: { fontSize: 14, lineHeight: 21, color: palette.ink, marginBottom: 18 },

  progressBlock: { marginBottom: 24 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: palette.hairline, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: palette.green },
  progressLabel: { fontSize: 12, color: palette.muted, marginTop: 6, fontWeight: '600' },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: palette.muted, marginBottom: 10 },

  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: palette.hairline, borderRadius: 8, marginBottom: 8,
    backgroundColor: palette.cream,
  },
  rewardRowEarned: { borderColor: `${palette.accent}88` },
  rewardDot: { width: 10, height: 10, borderRadius: 5 },
  rewardText: { flex: 1 },
  rewardTitle: { fontSize: 14, fontWeight: '700', color: palette.ink },
  rewardDesc: { fontSize: 12, color: palette.muted, marginTop: 2 },
  rewardStatus: { fontSize: 12, fontWeight: '700' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8, marginBottom: 4,
  },
  thumb: { width: 44, height: 62, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbEmblem: { fontSize: 22 },
  memberText: { flex: 1 },
  memberTitle: { fontSize: 15, fontWeight: '600', color: palette.ink, lineHeight: 19 },
  memberStatus: { fontSize: 12, fontWeight: '600', marginTop: 3 },
})
