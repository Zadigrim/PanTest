// Collector's passport book — all acquired passports.
import React, { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useCollectorPassports } from '../../hooks/usePassport'

export default function MyPassportsScreen() {
  const { passports, loading, reload } = useCollectorPassports()

  useFocusEffect(
    React.useCallback(() => { reload() }, [reload]),
  )

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
        keyExtractor={(cp) => cp.id}
        renderItem={({ item: cp }) => {
          const passport = (cp as any).passport
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/passport/${passport.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.spine, { backgroundColor: passport.cover_bg_color }]}>
                <Text style={styles.spineEmblem}>{passport.cover_emblem ?? '🧭'}</Text>
              </View>
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
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>No passports yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
              <Text style={styles.emptyLink}>Browse passports →</Text>
            </TouchableOpacity>
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
  list: { padding: 12 },
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
  title: { fontSize: 15, fontWeight: '700', color: '#0D1B2A', fontFamily: 'serif' },
  desc: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 2 },
  acquired: { fontSize: 11, color: '#1D9E75', marginTop: 4 },
  arrow: { fontSize: 22, color: '#ccc', paddingHorizontal: 14 },
  empty: { padding: 60, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#999' },
  emptyLink: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
})
