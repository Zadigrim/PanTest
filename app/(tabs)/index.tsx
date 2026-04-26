// Passport store / discovery — browse published passports.
import React from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { usePublishedPassports, acquirePassport } from '../../hooks/usePassport'
import { getCurrentUser } from '../../lib/supabase'
import type { Passport } from '../../types'

function PassportCard({ passport }: { passport: Passport }) {
  const handlePress = async () => {
    router.push(`/passport/${passport.id}`)
  }

  const handleAcquire = async () => {
    const user = await getCurrentUser()
    if (!user) { router.push('/(auth)/login'); return }
    await acquirePassport(passport.id, user.id)
    router.push(`/passport/${passport.id}`)
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={[styles.cardCover, { backgroundColor: passport.cover_bg_color }]}>
        <Text style={styles.coverEmblem}>{passport.cover_emblem ?? '🧭'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{passport.title}</Text>
        {passport.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{passport.description}</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            {passport.is_free ? 'Free' : `$${(passport.price_cents / 100).toFixed(2)}`}
          </Text>
          <TouchableOpacity onPress={handleAcquire} style={styles.acquireBtn}>
            <Text style={styles.acquireBtnText}>Get passport</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function DiscoverScreen() {
  const { passports, loading } = usePublishedPassports()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A84C" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={passports}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PassportCard passport={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No passports available yet.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardCover: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmblem: { fontSize: 42 },
  cardBody: { padding: 14 },
  cardTitle: {
    fontSize: 16, fontWeight: '700', color: '#0D1B2A',
    fontFamily: 'serif', marginBottom: 4,
  },
  cardDesc: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 14, color: '#888' },
  acquireBtn: { backgroundColor: '#1D9E75', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  acquireBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#aaa', fontStyle: 'italic' },
})
