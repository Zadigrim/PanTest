import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import type { Profile } from '../../types'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A84C" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>👤</Text>
      </View>
      <Text style={styles.name}>{profile?.display_name ?? 'Traveler'}</Text>
      <Text style={styles.role}>
        {profile?.role === 'employee' ? 'Employee' : 'Adventurer'}
      </Text>

      {profile?.role === 'employee' && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/employee')}
        >
          <Text style={styles.menuItemText}>🏷 Employee Terminal</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
        <Text style={[styles.menuItemText, styles.signOutText]}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.privacy}>
        Location is accessed only when stamping — never in the background.
        Your journal is private to you.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#0D1B2A', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, marginBottom: 12,
  },
  avatarEmoji: { fontSize: 36 },
  name: { fontSize: 22, fontWeight: '700', color: '#0D1B2A', fontFamily: 'serif' },
  role: { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 32, textTransform: 'capitalize' },
  menuItem: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  menuItemText: { fontSize: 16, color: '#0D1B2A' },
  menuArrow: { fontSize: 20, color: '#ccc' },
  signOutItem: { marginTop: 24, borderBottomWidth: 0 },
  signOutText: { color: '#C0392B' },
  privacy: {
    position: 'absolute', bottom: 32,
    fontSize: 11, color: '#bbb', textAlign: 'center',
    paddingHorizontal: 24, fontStyle: 'italic', lineHeight: 16,
  },
})
