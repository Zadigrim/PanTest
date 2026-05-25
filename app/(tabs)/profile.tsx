import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Switch, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import type { Profile } from '../../types'
import { palette } from '../../lib/colors'

const INK    = palette.ink
const MUTED  = palette.muted
const ACCENT = palette.accent
const NAVY   = palette.navy
const GREEN  = palette.green
const HAIRLINE = palette.hairline
const PAPER  = palette.paper

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { isEmployee, employeeMode, setEmployeeMode } = useEmployeeContext()

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
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const handleLearnMore = () => {
    WebBrowser.openBrowserAsync('https://okuji.app')
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color={ACCENT} /></View>
  }

  const isEmp = profile?.role === 'employee' || profile?.role === 'admin' || isEmployee

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Identity */}
      <View style={s.identity}>
        <View style={s.avatar}>
          <Text style={s.avatarInitial}>
            {(profile?.display_name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={s.name}>{profile?.display_name ?? 'Traveler'}</Text>
        <Text style={s.role}>{profile?.role ?? 'collector'}</Text>
      </View>

      {/* Workspace cards — employee terminal only (passport design lives on okuji.app) */}
      {isEmp && (
        <View style={s.workspaces}>
          <Text style={s.workspacesLabel}>WORKSPACES</Text>

          <TouchableOpacity
            style={s.wsCard}
            onPress={() => router.push('/employee' as any)}
            activeOpacity={0.75}
          >
            <View style={[s.wsIcon, { backgroundColor: ACCENT }]}>
              <Text style={s.wsIconGlyph}>🏷</Text>
            </View>
            <View style={s.wsText}>
              <Text style={s.wsTitle}>Employee Terminal</Text>
              <Text style={s.wsSubtitle}>Scan &amp; redeem stamps</Text>
            </View>
            <Text style={s.wsArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create your own — marketing link to the web app */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CREATE YOUR OWN PASSPORTS</Text>
        <Text style={{ fontSize: 14, color: MUTED, marginBottom: 12, lineHeight: 20 }}>
          Learn how teachers, institutions, and travelers are using Okuji to design their own collections.
        </Text>
        <TouchableOpacity
          onPress={handleLearnMore}
          activeOpacity={0.8}
          style={{ backgroundColor: PAPER, borderColor: HAIRLINE, borderWidth: 1, borderRadius: 8, padding: 14, alignItems: 'center' }}
        >
          <Text style={{ color: INK, fontWeight: '600' }}>Learn more at okuji.app</Text>
        </TouchableOpacity>
      </View>

      {/* Employee mode toggle */}
      {isEmployee && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SETTINGS</Text>
          <View style={s.menuRow}>
            <Text style={s.menuRowText}>Employee mode</Text>
            <Switch
              value={employeeMode}
              onValueChange={setEmployeeMode}
              trackColor={{ false: HAIRLINE, true: ACCENT }}
              thumbColor={employeeMode ? NAVY : '#f4f3f4'}
            />
          </View>
        </View>
      )}

      {/* Sign out */}
      <View style={s.section}>
        <TouchableOpacity style={s.signOutRow} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.privacy}>
        Location is accessed only when stamping — never in the background.
        Your journal entries are private to you.
      </Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', paddingTop: 36, paddingBottom: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 30, fontWeight: '700', color: ACCENT },
  name: { fontSize: 20, fontWeight: '700', color: INK },
  role: { fontSize: 12, color: MUTED, marginTop: 3, textTransform: 'capitalize' },

  workspaces: { paddingHorizontal: 20, paddingBottom: 12 },
  workspacesLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, color: MUTED,
    paddingTop: 20, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#f0ece3',
  },
  wsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: PAPER,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: '#e8e1d2',
  },
  wsIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  wsIconGlyph: { fontSize: 20 },
  wsText: { flex: 1 },
  wsTitle: { fontSize: 15, fontWeight: '700', color: INK },
  wsSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  wsArrow: { fontSize: 22, color: HAIRLINE },

  section: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1, borderTopColor: '#f0ece3',
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, color: MUTED, marginBottom: 10,
  },
  menuRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  menuRowText: { fontSize: 15, color: INK },

  signOutRow: { paddingVertical: 10 },
  signOutText: { fontSize: 15, color: '#c0392b', fontWeight: '500' },

  privacy: {
    paddingHorizontal: 24, paddingTop: 32,
    fontSize: 11, color: HAIRLINE, textAlign: 'center', lineHeight: 16, fontStyle: 'italic',
  },
})
