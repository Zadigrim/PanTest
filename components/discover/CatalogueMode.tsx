// Catalogue mode — horizontal shelf of passport cards with FREE / ISSUED pill.
//
// Visual + acquire logic live in ./PassportCard; this file just
// queries published passports and groups them into shelves.
import React from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { usePublishedPassports } from '../../hooks/usePassport'
import { usePublishedCollections } from '../../hooks/useCollection'
import { PassportCard, cardState, NAVY } from './PassportCard'
import { EmptyShelf } from '../ui/Illustrations'
import { palette } from '../../lib/colors'
import type { Passport, PassportCollection } from '../../types'

const GOLD = palette.accent

export default function CatalogueMode() {
  const { passports, ownedIds, loading, reload } = usePublishedPassports()
  const { collections } = usePublishedCollections()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    )
  }

  const available = passports.filter((p) => !ownedIds.has(p.id))
  const owned     = passports.filter((p) =>  ownedIds.has(p.id))

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

  function CollectionShelf() {
    if (collections.length === 0) return null
    return (
      <View style={styles.shelf}>
        <Text style={styles.shelfTitle}>Collections</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}
        >
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <CollectionShelf />
      <Shelf title="Available Passports" items={available} />
      <Shelf title="Owned"               items={owned} />
      {passports.length === 0 && (
        <View style={styles.empty}>
          <EmptyShelf width={200} />
          <Text style={styles.emptyText}>No passports available yet.</Text>
        </View>
      )}
    </ScrollView>
  )
}

function CollectionCard({ collection }: { collection: PassportCollection }) {
  return (
    <TouchableOpacity
      style={styles.collectionCard}
      activeOpacity={0.88}
      onPress={() => router.push(`/collection/${collection.id}`)}
    >
      {collection.edition_label ? (
        <Text style={styles.collectionEdition}>{collection.edition_label}</Text>
      ) : null}
      <Text style={styles.collectionTitle} numberOfLines={3}>{collection.title}</Text>
      {collection.subtitle ? (
        <Text style={styles.collectionSubtitle} numberOfLines={2}>{collection.subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Transparent so the Discover screen's interior field shows through.
  container: { flex: 1, backgroundColor: 'transparent' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  shelf:     { paddingTop: 20 },
  shelfTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  shelfRow: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  empty:    { padding: 40, alignItems: 'center', gap: 10 },
  emptyText:{ color: palette.muted, fontStyle: 'italic' },
  collectionCard: {
    width: 180,
    minHeight: 110,
    borderRadius: 8,
    padding: 14,
    backgroundColor: palette.navy,
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  collectionEdition: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  collectionTitle: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '700',
    color: palette.cream,
    lineHeight: 19,
  },
  collectionSubtitle: {
    fontSize: 11,
    color: 'rgba(245,240,232,0.75)',
    marginTop: 4,
    lineHeight: 15,
  },
})
