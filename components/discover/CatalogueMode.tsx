// Catalogue mode — horizontal shelf of passport cards with FREE / ISSUED pill.
//
// Visual + acquire logic live in ./PassportCard; this file just
// queries published passports and groups them into shelves.
import React from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { usePublishedPassports } from '../../hooks/usePassport'
import { PassportCard, cardState, NAVY } from './PassportCard'
import { palette } from '../../lib/colors'
import type { Passport } from '../../types'

const GOLD = palette.accent

export default function CatalogueMode() {
  const { passports, ownedIds, loading, reload } = usePublishedPassports()

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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Shelf title="Available Passports" items={available} />
      <Shelf title="My Collection"       items={owned} />
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
  empty:    { padding: 40, alignItems: 'center' },
  emptyText:{ color: '#aaa', fontStyle: 'italic' },
})
