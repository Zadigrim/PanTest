// OkujiDesigner — passport list for creator.
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import type { Passport } from '../../types'
import { palette } from '../../lib/colors'

export default function DesignerIndexScreen() {
  const [passports, setPassports] = useState<Passport[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('passports')
        .select('*')
        .eq('creator_id', user.id)
        .order('updated_at', { ascending: false })
      setPassports(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const createPassport = async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('passports')
      .insert({ creator_id: userId, title: 'New Passport', passport_type: 'location' })
      .select()
      .single()
    if (!error && data) {
      router.push(`/designer/${data.id}`)
    }
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator color={palette.accent} /></View>

  return (
    <View style={styles.container}>
      <FlatList
        data={passports}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push(`/designer/${item.id}`)}>
            <View style={[styles.swatch, { backgroundColor: item.cover_bg_color }]}>
              <Text style={styles.swatchEmoji}>{item.cover_emblem ?? '🧭'}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowStatus}>{item.is_published ? '● Published' : '○ Draft'}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <TouchableOpacity style={styles.createBtn} onPress={createPassport}>
            <Text style={styles.createBtnText}>+ New Passport</Text>
          </TouchableOpacity>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, marginBottom: 10, overflow: 'hidden',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  swatch: { width: 56, height: 64, alignItems: 'center', justifyContent: 'center' },
  swatchEmoji: { fontSize: 22 },
  rowBody: { flex: 1, padding: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: palette.navy },
  rowStatus: { fontSize: 12, color: '#888', marginTop: 2 },
  arrow: { fontSize: 22, color: '#ccc', paddingHorizontal: 14 },
  createBtn: {
    backgroundColor: palette.navy, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  createBtnText: { color: palette.cream, fontWeight: '700', fontSize: 15 },
})
