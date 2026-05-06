// Catalogue mode — horizontal shelf of passport cards with FREE / ISSUED pill.
import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { usePublishedPassports, acquirePassport } from '../../hooks/usePassport'
import { getCurrentUser } from '../../lib/supabase'
import type { Passport } from '../../types'

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'
const GREEN = '#1D9E75'
const CREAM = '#F5F0E8'
const CARD_W = 148
const CARD_H = 210

type CardState = 'owned' | 'free' | 'paid'

function cardState(passport: Passport, ownedIds: Set<string>): CardState {
  if (ownedIds.has(passport.id)) return 'owned'
  if (passport.is_free) return 'free'
  return 'paid'
}

function PassportCard({
  passport,
  state,
  onAcquired,
}: {
  passport: Passport
  state: CardState
  onAcquired: () => void
}) {
  const handlePress = () => router.push(`/passport/${passport.id}`)

  const handleAcquire = async () => {
    const user = await getCurrentUser()
    if (!user) { router.push('/(auth)/login'); return }
    await acquirePassport(passport.id, user.id)
    onAcquired()
    router.push(`/passport/${passport.id}`)
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: passport.cover_bg_color }]}
      onPress={state === 'owned' ? handlePress : undefined}
      activeOpacity={0.88}
    >
      {/* Cover emblem */}
      <Text style={styles.cardEmblem}>{passport.cover_emblem ?? '🧭'}</Text>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {passport.title}
      </Text>

      {/* Pill row */}
      <View style={styles.pillRow}>
        {state === 'owned' && (
          <View style={styles.pillIssued}>
            <Text style={styles.pillIssuedText}>ISSUED</Text>
          </View>
        )}
        {state === 'free' && (
          <View style={styles.pillFree}>
            <Text style={styles.pillFreeText}>FREE</Text>
          </View>
        )}
        {state === 'paid' && (
          <View style={styles.pillPaid}>
            <Text style={styles.pillPaidText}>
              ${(passport.price_cents / 100).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* CTA */}
      {state === 'owned' ? (
        <TouchableOpacity style={styles.ctaOpen} onPress={handlePress}>
          <Text style={styles.ctaOpenText}>Open</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.ctaGet} onPress={handleAcquire}>
          <Text style={styles.ctaGetText}>{state === 'free' ? 'Get' : 'Buy'}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

export default function CatalogueMode() {
  const { passports, ownedIds, loading, reload } = usePublishedPassports()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    )
  }

  // Shelves: "Available" (unowned) and "My Passports" (owned)
  const available = passports.filter((p) => !ownedIds.has(p.id))
  const owned = passports.filter((p) => ownedIds.has(p.id))

  function Shelf({ title, items }: { title: string; items: Passport[] }) {
    if (items.length === 0) return null
    return (
      <View style={styles.shelf}>
        <Text style={styles.shelfTitle}>{title}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}
        >
          {items.map((p) => (
            <PassportCard
              key={p.id}
              passport={p}
              state={cardState(p, ownedIds)}
              onAcquired={reload}
            />
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Shelf title="Available Passports" items={available} />
      <Shelf title="My Collection" items={owned} />
      {passports.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No passports available yet.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  shelf: { paddingTop: 20 },
  shelfTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  shelfRow: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  cardEmblem: {
    fontSize: 32,
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  cardTitle: {
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '700',
    color: CREAM,
    marginBottom: 6,
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pillIssued: {
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${GOLD}66`,
  },
  pillIssuedText: { fontSize: 8, color: GOLD, fontWeight: '700', letterSpacing: 1 },
  pillFree: {
    backgroundColor: 'rgba(29,158,117,0.25)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${GREEN}66`,
  },
  pillFreeText: { fontSize: 8, color: GREEN, fontWeight: '700', letterSpacing: 1 },
  pillPaid: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillPaidText: { fontSize: 8, color: CREAM, fontWeight: '600' },
  ctaGet: {
    backgroundColor: GREEN,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  ctaGetText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  ctaOpen: {
    borderWidth: 1.5,
    borderColor: `${GOLD}88`,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  ctaOpenText: { color: GOLD, fontWeight: '700', fontSize: 11 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#aaa', fontStyle: 'italic' },
})
