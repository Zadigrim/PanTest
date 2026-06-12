// Passport card — shared between Catalogue and Nearby on Discover.
//
// One source of truth for the discovery-card visual. Mutating the
// look (palette, pill copy, size) belongs here, not at the call
// sites. The optional `nearbyInfo` prop adds the discovery-specific
// "nearest stop / N stops nearby" line above the pricing pill;
// when absent the card renders exactly as it did inside
// CatalogueMode.

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { getCurrentUser } from '../../lib/supabase'
import { acquirePassport } from '../../hooks/usePassport'
import { palette } from '../../lib/colors'
import type { Passport } from '../../types'

const NAVY = palette.navy
const GOLD = palette.accent
const GREEN = palette.green
const CREAM = palette.cream
export const CARD_W = 148
export const CARD_H = 210

export type CardState = 'owned' | 'free' | 'paid'

export function cardState(passport: Passport, ownedIds: Set<string>): CardState {
  if (ownedIds.has(passport.id)) return 'owned'
  if (passport.is_free) return 'free'
  return 'paid'
}

export interface NearbyInfo {
  /** Distance in METERS to the closest physical stop on this passport. */
  distanceM: number
  /** How many physical stops fall inside the user's search radius. */
  stopsInRadius: number
}

interface Props {
  passport: Passport
  state: CardState
  onAcquired: () => void
  /** When set, replaces the default state-driven CTA flow's
   *  bottom-of-card spacing with a small "nearest stop · N
   *  stops nearby" subline above the pricing pill. */
  nearbyInfo?: NearbyInfo
}

export function PassportCard({ passport, state, onAcquired, nearbyInfo }: Props) {
  const handlePress = () => router.push(`/passport/${passport.id}`)

  const handleAcquire = async () => {
    const user = await getCurrentUser()
    if (!user) {
      router.push('/(auth)/login')
      return
    }
    // Premium passports can't be acquired in-app yet (no in-app purchase
    // rail). Neutral message — no steering to web checkout (Play policy).
    if (state === 'paid') {
      Alert.alert('Premium passport', 'Premium passports aren’t available to acquire in the app yet.')
      return
    }
    const { error } = await acquirePassport(passport.id, user.id)
    if (error) {
      Alert.alert('Couldn’t acquire', 'Please try again in a moment.')
      return
    }
    onAcquired()
    router.push(`/passport/${passport.id}`)
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: passport.cover_bg_color }]}
      onPress={state === 'owned' ? handlePress : undefined}
      activeOpacity={0.88}
    >
      {/* Front-cover thumbnail (kobo-generated, rightmost 612px panel).
          Falls back to the cover color + emblem + title when absent. */}
      {passport.cover_thumbnail ? (
        <>
          <Image
            source={{ uri: passport.cover_thumbnail }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          <Text style={styles.cardEmblem}>{passport.cover_emblem ?? '🧭'}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {passport.title}
          </Text>
        </>
      )}

      {nearbyInfo && (
        <Text style={styles.nearbyLine} numberOfLines={1}>
          {formatNearby(nearbyInfo)}
        </Text>
      )}

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
            <Text style={styles.pillPaidText}>${(passport.price_cents / 100).toFixed(2)}</Text>
          </View>
        )}
      </View>

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

function formatNearby({ distanceM, stopsInRadius }: NearbyInfo): string {
  const distLabel =
    distanceM < 1000
      ? `${Math.round(distanceM)} m`
      : `${(distanceM / 1000).toFixed(distanceM < 10_000 ? 1 : 0)} km`
  const stopWord = stopsInRadius === 1 ? 'stop' : 'stops'
  return `nearest ${distLabel} · ${stopsInRadius} ${stopWord} nearby`
}

const styles = StyleSheet.create({
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
  nearbyLine: {
    fontSize: 9,
    color: 'rgba(245,240,232,0.8)',
    marginBottom: 6,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  pillRow: { flexDirection: 'row', marginBottom: 8 },
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
  ctaGet: { backgroundColor: GREEN, borderRadius: 6, paddingVertical: 7, alignItems: 'center' },
  ctaGetText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  ctaOpen: {
    borderWidth: 1.5,
    borderColor: `${GOLD}88`,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  ctaOpenText: { color: GOLD, fontWeight: '700', fontSize: 11 },
})

// Re-export NAVY so CatalogueMode (and any other consumers) can
// share the palette constants without re-importing.
export { NAVY }
