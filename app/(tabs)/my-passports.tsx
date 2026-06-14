// Collector's passport book — all acquired passports.
import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ImageBackground } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useCollectorPassports } from '../../hooks/usePassport'
import { palette } from '../../lib/colors'
import { EmptyShelf } from '../../components/ui/Illustrations'

export default function MyPassportsScreen() {
  const { passports, loading, reload } = useCollectorPassports()

  useFocusEffect(
    React.useCallback(() => { reload() }, [reload]),
  )

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} />
      </View>
    )
  }

  return (
    <ImageBackground
      source={require('../../assets/brand/okuji-bg-interior.png')}
      style={styles.container}
      imageStyle={styles.interior}
      resizeMode="cover"
    >
      <FlatList
        data={passports}
        keyExtractor={(cp) => cp.id}
        renderItem={({ item: cp }) => {
          const passport = (cp as any).passport
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/passport/${passport.id}`)}
              activeOpacity={0.75}
            >
              {passport.cover_thumbnail ? (
                <Image source={{ uri: passport.cover_thumbnail }} style={styles.spine} resizeMode="cover" />
              ) : (
                <View style={[styles.spine, { backgroundColor: passport.cover_bg_color }]}>
                  <Text style={styles.spineEmblem}>{passport.cover_emblem ?? '🧭'}</Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={styles.title}>{passport.title}</Text>
                {passport.description && (
                  <Text style={styles.desc} numberOfLines={1}>{passport.description}</Text>
                )}
                <Text style={styles.acquired}>
                  {cp.completed_at ? '✓ Completed' : `Acquired ${new Date(cp.acquired_at).toLocaleDateString()}`}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyShelf width={220} />
            <Text style={styles.emptyText}>Your shelf is empty.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
              <Text style={styles.emptyLink}>Browse passports →</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.cream },
  // The interior field sits softly behind the cards so the list reads as
  // pages in a passport, not a flat gray sheet. Kept low-contrast so the
  // white rows stay legible.
  interior: { opacity: 0.5 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  spine: {
    width: 56,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spineEmblem: { fontSize: 22 },
  rowBody: { flex: 1, padding: 12 },
  title: { fontSize: 15, fontWeight: '700', color: palette.navy, fontFamily: 'serif' },
  desc: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 2 },
  acquired: { fontSize: 11, color: palette.green, marginTop: 4 },
  arrow: { fontSize: 22, color: '#ccc', paddingHorizontal: 14 },
  empty: { flex: 1, paddingVertical: 60, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: palette.muted, marginTop: 4 },
  emptyLink: { fontSize: 14, color: palette.green, fontWeight: '600' },
})
