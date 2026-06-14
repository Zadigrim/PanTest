// Nearby mode — published passports with a physical stop within
// 25 km of the user's current position. v1 is a LIST (no map);
// passport cards are reused from CatalogueMode via PassportCard.
//
// PRIVACY: the user's coordinates are obtained ephemerally inside
// fetchNearbyPassports(), passed to the find_passports_nearby()
// RPC exactly once, and discarded. No coordinate value ever lands
// in this component's state, AsyncStorage, or any log. See
// lib/nearby.ts and migration 012 for the full data path.

import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { usePublishedPassports } from '../../hooks/usePassport'
import {
  fetchNearbyPassports,
  type NearbyPassport,
  type NearbyPermissionState,
} from '../../lib/nearby'
import { FEATURES } from '../../lib/features'
import { palette } from '../../lib/colors'
import { PassportCard, cardState } from './PassportCard'
import { EmptyNearby } from '../ui/Illustrations'
import type { Passport } from '../../types'

const NAVY  = palette.navy
const GOLD  = palette.accent
const INK   = palette.ink
const MUTED = '#6b6356'

type LoadState =
  | { kind: 'idle' }                                    // pre-permission
  | { kind: 'loading' }                                 // fetching
  | { kind: 'ok'; passports: NearbyPassport[] }         // got results (may be empty)
  | { kind: 'denied' }                                  // permission denied
  | { kind: 'unavailable' }                             // permission ok, fix failed (timeout/signal)
  | { kind: 'error'; message: string }                  // RPC error

export default function NearbyMode() {
  // ── Feature flag — keeps the surface dark in deployed builds
  // without removing the entire code path. Flip in lib/features.ts.
  if (!FEATURES.NEARBY_DISCOVERY) {
    return <DormantCard />
  }

  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  // Owned-ids set is read once via the existing hook so the
  // PassportCard's CTA logic ("ISSUED" vs "Get" vs "Buy") stays
  // in sync with Catalogue. Cheap query.
  const { ownedIds, reload: reloadOwned } = usePublishedPassports()

  const run = useCallback(async () => {
    setState({ kind: 'loading' })
    const result = await fetchNearbyPassports()
    if (result.error) {
      setState({ kind: 'error', message: result.error })
      return
    }
    switch (result.state) {
      case 'denied':      setState({ kind: 'denied' });      return
      case 'unavailable': setState({ kind: 'unavailable' }); return
      case 'granted':     setState({ kind: 'ok', passports: result.passports })
    }
  }, [])

  // Don't auto-run on mount — that would silently trigger the OS
  // permission prompt before the user has any context. The
  // explainer card stays up until they tap "Find passports near me".
  // (If we already have permission from a previous session we still
  // wait for the explicit tap; one extra tap is a small price for
  // predictable consent.)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollPad}>
      <SectionHeader />

      {state.kind === 'idle' && <ExplainerCard onTap={run} />}

      {state.kind === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.loadingText}>Finding passports near you…</Text>
        </View>
      )}

      {state.kind === 'denied' && (
        <PermissionDeniedCard
          onOpenSettings={() => {
            if (Platform.OS === 'ios') {
              void Linking.openURL('app-settings:')
            } else {
              void Linking.openSettings()
            }
          }}
        />
      )}

      {state.kind === 'unavailable' && (
        <UnavailableCard onRetry={run} />
      )}

      {state.kind === 'error' && (
        <ErrorCard message={state.message} onRetry={run} />
      )}

      {state.kind === 'ok' && (
        state.passports.length === 0
          ? <EmptyResultsCard />
          : <ResultsList
              passports={state.passports}
              ownedIds={ownedIds}
              onAcquired={reloadOwned}
              onRefresh={run}
            />
      )}
    </ScrollView>
  )
}

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Near me</Text>
      <Text style={styles.headerSubtitle}>
        Published passports with a stop close to where you are.
      </Text>
    </View>
  )
}

// ── First-use explainer ────────────────────────────────────────────────────
//
// Honest permission ask — the explainer text states the privacy
// commitment up-front so users know what tapping the button does
// before they see the native OS prompt.

function ExplainerCard({ onTap }: { onTap: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>See passports near you</Text>
      <Text style={styles.cardBody}>
        Your location is used only for this search and{' '}
        <Text style={styles.bodyEmphasis}>never stored</Text>. The
        app reads your position once when you tap below and forgets
        it as soon as the results come back.
      </Text>
      <TouchableOpacity style={styles.primary} onPress={onTap}>
        <Text style={styles.primaryText}>Find passports near me</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Empty + degraded states ────────────────────────────────────────────────

function EmptyResultsCard() {
  return (
    <View style={[styles.card, styles.cardCentered]}>
      <EmptyNearby width={200} />
      <Text style={[styles.cardTitle, styles.cardTitleCentered]}>No passports near you yet</Text>
      <Text style={[styles.cardBody, styles.cardBodyCentered]}>
        Okuji is growing — new passports get published every week. In
        the meantime, browse what&rsquo;s already out there.
      </Text>
      <TouchableOpacity
        style={[styles.secondary, styles.secondaryCentered]}
        onPress={() => router.push('/(tabs)')}
      >
        <Text style={styles.secondaryText}>Explore all passports →</Text>
      </TouchableOpacity>
    </View>
  )
}

function PermissionDeniedCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Enable location to discover passports</Text>
      <Text style={styles.cardBody}>
        Okuji needs a one-time read of your location to find
        passports around you. We never store or share it.
      </Text>
      <TouchableOpacity style={styles.secondary} onPress={onOpenSettings}>
        <Text style={styles.secondaryText}>Open settings →</Text>
      </TouchableOpacity>
    </View>
  )
}

function UnavailableCard({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Couldn&rsquo;t get your location</Text>
      <Text style={styles.cardBody}>
        Your phone didn&rsquo;t return a location fix in time. This
        usually clears up by trying again or moving outside.
      </Text>
      <TouchableOpacity style={styles.primary} onPress={onRetry}>
        <Text style={styles.primaryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Something went wrong</Text>
      <Text style={styles.cardBody}>{message}</Text>
      <TouchableOpacity style={styles.primary} onPress={onRetry}>
        <Text style={styles.primaryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  )
}

function DormantCard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollPad}>
      <SectionHeader />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coming soon</Text>
        <Text style={styles.cardBody}>
          Nearby passport discovery is on the way. Browse the
          catalogue in the meantime.
        </Text>
      </View>
    </ScrollView>
  )
}

// ── Results ────────────────────────────────────────────────────────────────

function ResultsList({
  passports,
  ownedIds,
  onAcquired,
  onRefresh,
}: {
  passports: NearbyPassport[]
  ownedIds: Set<string>
  onAcquired: () => void
  onRefresh: () => void
}) {
  return (
    <View>
      <View style={styles.resultsHead}>
        <Text style={styles.resultsCount}>
          {passports.length} passport{passports.length === 1 ? '' : 's'} nearby
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.refreshLink}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cards}>
        {passports.map((p) => {
          // Project the RPC row into the shape PassportCard expects.
          // The RPC includes everything the card reads (title,
          // emblem, bg color, price); other Passport fields are
          // filled with safe defaults — the card doesn't read them.
          const projected = projectToPassport(p)
          return (
            <PassportCard
              key={p.passport_id}
              passport={projected}
              state={cardState(projected, ownedIds)}
              onAcquired={onAcquired}
              nearbyInfo={{
                distanceM:     p.distance_m,
                stopsInRadius: p.stops_in_radius,
              }}
            />
          )
        })}
      </View>
    </View>
  )
}

function projectToPassport(r: NearbyPassport): Passport {
  // PassportCard only reads: id, title, cover_emblem,
  // cover_bg_color, is_free, price_cents. Other Passport fields
  // are filled with type-safe defaults that the card never
  // touches — this keeps the projection isolated to one place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    id:                 r.passport_id,
    creator_id:         r.creator_id,
    proprietor_id:      r.proprietor_id,
    title:              r.title,
    description:        null,
    passport_type:      'general' as Passport['passport_type'],
    cover_bg_color:     r.cover_bg_color ?? '#0d1b2a',
    cover_bg_type:      'solid' as Passport['cover_bg_type'],
    cover_image_url:    null,
    cover_thumbnail:    r.cover_thumbnail ?? null,
    cover_emblem:       r.cover_emblem ?? '🧭',
    illus_type:         '',
    illus_color:        '',
    illus_opacity:      0,
    paper_color:        '#f5f0e8',
    is_published:       true,
    is_free:            r.is_free,
    price_cents:        r.price_cents,
    is_demo:            false,
    cover_outside_data: null,
    cover_inside_data:  null,
    created_at:         '',
    updated_at:         '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Transparent so the Discover screen's interior field shows through.
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollPad: { paddingBottom: 32 },

  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  headerTitle: {
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: '700',
    color: NAVY,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
  },

  loading: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: MUTED, fontSize: 12, marginTop: 10, fontStyle: 'italic' },

  card: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4dcc8',
  },
  cardCentered: { alignItems: 'center' },
  cardTitle: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 6,
  },
  cardTitleCentered: { marginTop: 10, textAlign: 'center' },
  cardBody: { fontSize: 13, color: INK, lineHeight: 19 },
  cardBodyCentered: { textAlign: 'center' },
  bodyEmphasis: { fontWeight: '700', color: NAVY },

  primary: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: palette.green,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  secondary: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryCentered: { alignSelf: 'center' },
  secondaryText: { color: NAVY, fontWeight: '700', fontSize: 13 },

  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  resultsCount: { fontSize: 11, color: MUTED, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  refreshLink:  { fontSize: 12, color: palette.green, fontWeight: '600' },

  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
})
