import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Switch, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { useDemoContext } from '../../contexts/DemoContext'
import { backfillJournalPhotos } from '../../lib/journal-photo-backfill'
import { useViewerPrefs, type StampGuideMode } from '../../lib/viewer-prefs'

const STAMP_GUIDE_OPTIONS: { value: StampGuideMode; label: string }[] = [
  { value: 'off',  label: 'Off' },
  { value: 'ring', label: 'Ring' },
  { value: 'box',  label: 'Box' },
]
import { formatCoordinates } from '../../lib/location-caption'
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
  const [backfilling, setBackfilling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [locating, setLocating] = useState(false)
  const { isEmployee, employeeMode, setEmployeeMode } = useEmployeeContext()
  const { demoAuthorized, demoMode, setDemoMode } = useDemoContext()
  const { prefs: viewerPrefs, update: updateViewerPref } = useViewerPrefs()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      // Owner-only surfaces gate on the canonical is_platform_admin() RPC —
      // the single admin check (never a parallel role test on profiles).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: adminFlag } = await (supabase as any).rpc('is_platform_admin')
      setIsAdmin(adminFlag === true)
      setLoading(false)
    }
    load()
  }, [])

  // Owner-only diagnostic: read the current GPS fix and show it once.
  // Ephemeral — nothing is stored, logged, or sent anywhere. Same
  // foreground-only permission posture as stamping.
  const handleShowLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location', 'Location permission is needed to read your current GPS fix.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
      const coords = formatCoordinates(pos.coords.latitude, pos.coords.longitude)
      Alert.alert(
        'Current GPS',
        coords
          ? `${coords}\n±${Math.round(pos.coords.accuracy ?? 0)} m\n\nNot stored — diagnostic only.`
          : 'Could not read a valid GPS fix.',
      )
    } catch {
      Alert.alert('Location', 'Could not read your current location.')
    } finally {
      setLocating(false)
    }
  }

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

  // On-demand only — uploads pre-existing local journal photos to storage so
  // they survive reinstall/device changes. Never runs automatically.
  const handleBackupPhotos = async () => {
    const user = await getCurrentUser()
    if (!user) return
    setBackfilling(true)
    try {
      const r = await backfillJournalPhotos(user.id)
      Alert.alert('Journal photos', `Backed up ${r.uploaded} photo(s). ${r.lost} missing, ${r.failed} failed.`)
    } catch {
      Alert.alert('Journal photos', 'Backup could not complete. Please try again later.')
    } finally {
      setBackfilling(false)
    }
  }

  // Permanent, irreversible account deletion. Calls the same
  // close_user_account RPC the web uses (migration 049): it deletes the
  // caller's journal, photos, stamps, and collection and removes the
  // auth.users row, while preserving other holders' acquired passports
  // in custodial form. The RPC self-authorizes (caller may only close
  // their own account), so we pass the current user's id.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, journal entries, photos, stamps, and collection. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const user = await getCurrentUser()
            if (!user) { router.replace('/(auth)/login'); return }
            setDeleting(true)
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any).rpc('close_user_account', { target_user_id: user.id })
              if (error) {
                setDeleting(false)
                Alert.alert('Could not delete account', error.message ?? 'Please try again later.')
                return
              }
              await supabase.auth.signOut()
              router.replace('/(auth)/login')
            } catch {
              setDeleting(false)
              Alert.alert('Could not delete account', 'Please try again later.')
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color={ACCENT} /></View>
  }

  // Verifier surfaces gate on the live can_verify authorization only
  // (EmployeeContext sets isEmployee strictly from an employee_authorizations
  // row with can_verify = true). A stale profiles.role is not enough — the
  // terminal is hidden AND the route guard in app/employee/_layout.tsx
  // redirects non-verifiers, so this is enforced, not merely visual.
  const isEmp = isEmployee

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

      {/* Employee mode + demo mode toggles. Demo Mode renders ONLY for
          server-authorized users (is_demo_authorized(): platform admin or
          an admin-set reviewer flag) — invisible to ordinary users, and
          every bypass it enables is re-checked server-side anyway. */}
      {(isEmployee || demoAuthorized) && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SETTINGS</Text>
          {isEmployee && (
            <View style={s.menuRow}>
              <Text style={s.menuRowText}>Employee mode</Text>
              <Switch
                value={employeeMode}
                onValueChange={setEmployeeMode}
                trackColor={{ false: HAIRLINE, true: ACCENT }}
                thumbColor={employeeMode ? NAVY : '#f4f3f4'}
              />
            </View>
          )}
          {demoAuthorized && (
            <>
              <View style={s.menuRow}>
                <Text style={s.menuRowText}>Demo mode</Text>
                <Switch
                  value={demoMode}
                  onValueChange={setDemoMode}
                  trackColor={{ false: HAIRLINE, true: ACCENT }}
                  thumbColor={demoMode ? NAVY : '#f4f3f4'}
                />
              </View>
              <Text style={s.dangerHint}>
                Acquire passports free and stamp without verification. Demo
                stamps are marked and never count as verified visits.
              </Text>
            </>
          )}
        </View>
      )}

      {/* Reader display options — personal toggles, not part of the passport
          design. Default on; opening a passport afresh reflects changes. */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>READING</Text>
        <View style={s.menuRow}>
          <Text style={s.menuRowText}>Table of contents</Text>
          <Switch
            value={viewerPrefs.showToc}
            onValueChange={(v) => void updateViewerPref('showToc', v)}
            trackColor={{ false: HAIRLINE, true: ACCENT }}
            thumbColor={viewerPrefs.showToc ? NAVY : '#f4f3f4'}
          />
        </View>
        <View style={s.menuRow}>
          <Text style={s.menuRowText}>Exit visa pages</Text>
          <Switch
            value={viewerPrefs.showExitVisa}
            onValueChange={(v) => void updateViewerPref('showExitVisa', v)}
            trackColor={{ false: HAIRLINE, true: ACCENT }}
            thumbColor={viewerPrefs.showExitVisa ? NAVY : '#f4f3f4'}
          />
        </View>
        {/* Stamp guides — how un-earned slots are marked. Off = the clean
            designed look; Ring / Box show where to stamp. */}
        <View style={[s.menuRow, s.menuRowStacked]}>
          <Text style={s.menuRowText}>Stamp guides</Text>
          <View style={s.segment}>
            {STAMP_GUIDE_OPTIONS.map((opt) => {
              const active = viewerPrefs.stampGuide === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.segBtn, active && s.segBtnActive]}
                  onPress={() => void updateViewerPref('stampGuide', opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.segText, active && s.segTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>

      {/* Journal photo backup (on-demand) */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>JOURNAL PHOTOS</Text>
        <TouchableOpacity style={s.menuRow} onPress={handleBackupPhotos} disabled={backfilling}>
          <Text style={s.menuRowText}>{backfilling ? 'Backing up…' : 'Back up older journal photos'}</Text>
          {backfilling && <ActivityIndicator color={ACCENT} />}
        </TouchableOpacity>
      </View>

      {/* Owner tools — platform admin only (is_platform_admin RPC).
          GPS read is ephemeral: shown once, never stored. */}
      {isAdmin && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>OWNER TOOLS</Text>
          <TouchableOpacity style={s.menuRow} onPress={handleShowLocation} disabled={locating}>
            <View style={s.ownerRowLeft}>
              <Ionicons name="location-outline" size={18} color={INK} />
              <Text style={s.menuRowText}>{locating ? 'Reading GPS…' : 'Show current GPS'}</Text>
            </View>
            {locating && <ActivityIndicator color={ACCENT} />}
          </TouchableOpacity>
          <Text style={s.dangerHint}>Ephemeral diagnostic — your location is shown once and never stored.</Text>
        </View>
      )}

      {/* Sign out */}
      <View style={s.section}>
        <TouchableOpacity style={s.signOutRow} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Danger zone — permanent account deletion (Play data-deletion
          requirement: an in-app path to delete your account + data). */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>DANGER ZONE</Text>
        <TouchableOpacity style={s.menuRow} onPress={handleDeleteAccount} disabled={deleting}>
          <Text style={s.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
          {deleting && <ActivityIndicator color="#c0392b" />}
        </TouchableOpacity>
        <Text style={s.dangerHint}>
          Permanently deletes your account, journal, stamps, and collection. This cannot be undone.
        </Text>
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
  menuRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f0ece3',
    borderRadius: 8,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  segBtnActive: { backgroundColor: ACCENT },
  segText: { fontSize: 13, fontWeight: '600', color: MUTED },
  segTextActive: { color: NAVY },
  ownerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  signOutRow: { paddingVertical: 10 },
  signOutText: { fontSize: 15, color: '#c0392b', fontWeight: '500' },

  deleteText: { fontSize: 15, color: '#c0392b', fontWeight: '600' },
  dangerHint: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 17 },

  privacy: {
    paddingHorizontal: 24, paddingTop: 32,
    fontSize: 11, color: HAIRLINE, textAlign: 'center', lineHeight: 16, fontStyle: 'italic',
  },
})
