import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView,
} from 'react-native'
import { Slot, router, usePathname } from 'expo-router'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { palette } from '../../lib/colors'

// ── Counter context — child screens call refresh() after a scan/distribution ──
interface CounterCtx { refresh: () => void }
const Ctx = createContext<CounterCtx>({ refresh: () => {} })
export function useCounterRefresh() { return useContext(Ctx) }

const INK = palette.ink
const PAPER = palette.paper
const MUTED = palette.muted
const HAIRLINE = palette.hairline
const ACCENT = palette.accent
const GREEN = palette.green
const NAVY = palette.navy
const RAIL_W = 300
const WIDE_BP = 680

interface Stats { scans: number; given: number; pending: number }
interface RecentItem {
  id: string
  token_code: string
  prize_given: string | null
  redeemed_at: string | null
  distribution_pending: boolean
  distribution_logged_at: string | null
  prize_distributed: boolean
}

const NAV = [
  { key: 'scan',   label: 'Scan',   path: '/employee' },
  { key: 'recent', label: 'Recent', path: '/employee/recent' },
  { key: 'help',   label: 'Help',   path: '/employee/help' },
] as const

export default function CounterLayout() {
  const { width } = useWindowDimensions()
  const isWide = width >= WIDE_BP
  const pathname = usePathname()
  const isRedeem = pathname.includes('/redeem')

  const { employeeAuth, authResolved } = useEmployeeContext()
  const [userId, setUserId] = useState<string | null>(null)
  const [venueName, setVenueName] = useState('')

  // Enforce verifier access: once the can_verify lookup resolves, bounce
  // any user without an authorization out of the terminal (not just
  // hidden in the profile). Server functions also reject non-verifiers.
  useEffect(() => {
    if (authResolved && !employeeAuth) {
      router.replace('/(tabs)/profile' as any)
    }
  }, [authResolved, employeeAuth])
  const [stats, setStats] = useState<Stats>({ scans: 0, given: 0, pending: 0 })
  const [recent, setRecent] = useState<RecentItem[]>([])

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { router.replace('/(auth)/login'); return }
      setUserId(u.id)
      // Venue name comes from the EmployeeContext join (institutions.name).
      // Falls back to '' until the context hydrates.
      setVenueName(employeeAuth?.institution_name ?? '')
    })
  }, [employeeAuth?.institution_name])

  const loadStats = useCallback(async () => {
    if (!userId) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('completion_tokens')
      .select('id, token_code, prize_given, redeemed_at, distribution_pending, distribution_logged_at, prize_distributed')
      .eq('redeemed_by', userId)
      .gte('redeemed_at', today.toISOString())
      .order('redeemed_at', { ascending: false })
      .limit(50)
    const rows = data ?? []
    setStats({
      scans: rows.length,
      given: rows.filter(r => r.prize_distributed && !r.distribution_pending).length,
      pending: rows.filter(r => r.distribution_pending).length,
    })
    setRecent(rows.slice(0, 6) as RecentItem[])
  }, [userId])

  useEffect(() => { loadStats() }, [loadStats])

  const activeTab = pathname.endsWith('/recent') ? 'recent'
    : pathname.endsWith('/help') ? 'help'
    : 'scan'

  return (
    <Ctx.Provider value={{ refresh: loadStats }}>
      <View style={[s.root, isWide && s.rootRow]}>

        {isWide ? (
          // ── Wide: persistent left rail ──────────────────────────────────
          <View style={s.rail}>
            <TouchableOpacity style={s.backBrand} onPress={() => router.back()}>
              <Text style={s.brandMark}>Connect</Text>
              {!!venueName && <Text style={s.venueName} numberOfLines={1}>{venueName}</Text>}
            </TouchableOpacity>

            <View style={s.counters}>
              {([
                { label: 'scans',   val: stats.scans },
                { label: 'given',   val: stats.given },
                { label: 'pending', val: stats.pending },
              ] as const).map(({ label, val }) => (
                <View key={label} style={s.counterCell}>
                  <Text style={s.counterNum}>{val}</Text>
                  <Text style={s.counterLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={s.divider} />

            <Text style={s.recentHeading}>RECENT</Text>
            <ScrollView style={s.recentScroll} showsVerticalScrollIndicator={false}>
              {recent.length === 0
                ? <Text style={s.noRecent}>No scans today</Text>
                : recent.map(item => {
                    const dot = item.prize_distributed && !item.distribution_pending
                      ? GREEN : item.distribution_pending ? ACCENT : HAIRLINE
                    return (
                      <View key={item.id} style={s.recentRow}>
                        <View style={[s.dot, { backgroundColor: dot }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.recentToken}>{item.token_code}</Text>
                          {!!item.prize_given &&
                            <Text style={s.recentPrize} numberOfLines={1}>{item.prize_given}</Text>}
                        </View>
                        {!!item.redeemed_at &&
                          <Text style={s.recentTime}>
                            {new Date(item.redeemed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>}
                      </View>
                    )
                  })
              }
            </ScrollView>

            <View style={s.divider} />

            {!isRedeem && (
              <View style={s.railNav}>
                {NAV.map(({ key, label, path }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.navItem, activeTab === key && s.navItemActive]}
                    onPress={() => router.push(path as any)}
                  >
                    <Text style={[s.navLabel, activeTab === key && s.navLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.helpPin} onPress={() => router.push('/employee/help' as any)}>
              <Text style={s.helpPinText}>? Help</Text>
            </TouchableOpacity>
          </View>

        ) : (
          // ── Narrow: compact top strip ────────────────────────────────────
          <View style={s.topStrip}>
            <View style={s.stripRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.brandMarkNarrow}>Connect</Text>
                {!!venueName && <Text style={s.venueNarrow}>{venueName}</Text>}
              </TouchableOpacity>
              <View style={s.statsRow}>
                {([
                  { label: 'scans',   val: stats.scans },
                  { label: 'given',   val: stats.given },
                  { label: 'pending', val: stats.pending },
                ] as const).map(({ label, val }) => (
                  <View key={label} style={s.statChip}>
                    <Text style={s.statNum}>{val}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {!isRedeem && (
              <View style={s.topTabs}>
                {NAV.map(({ key, label, path }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.topTab, activeTab === key && s.topTabActive]}
                    onPress={() => router.push(path as any)}
                  >
                    <Text style={[s.topTabLabel, activeTab === key && s.topTabLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Workspace — renders current route */}
        <View style={s.workspace}>
          <Slot />
        </View>

      </View>
    </Ctx.Provider>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column', backgroundColor: PAPER },
  rootRow: { flexDirection: 'row' },

  // ── Left rail ────────────────────────────────────────────────────────────
  rail: {
    width: RAIL_W,
    backgroundColor: PAPER,
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
    paddingBottom: 16,
  },
  backBrand: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    marginBottom: 4,
  },
  brandMark: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  venueName: {
    fontSize: 14,
    fontWeight: '600',
    color: INK,
    marginTop: 3,
  },
  counters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  counterCell: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 28, fontWeight: '700', color: INK, lineHeight: 32 },
  counterLabel: { fontSize: 10, color: MUTED, textTransform: 'lowercase', marginTop: 2 },
  divider: { height: 1, backgroundColor: HAIRLINE, marginHorizontal: 16, marginVertical: 4 },
  recentHeading: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, color: MUTED,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6,
  },
  recentScroll: { flex: 1, paddingHorizontal: 16 },
  noRecent: { fontSize: 12, color: HAIRLINE, fontStyle: 'italic', paddingVertical: 8 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  recentToken: { fontSize: 11, fontWeight: '600', color: INK, fontFamily: 'monospace', letterSpacing: 1 },
  recentPrize: { fontSize: 10, color: MUTED, marginTop: 1 },
  recentTime: { fontSize: 10, color: MUTED },
  railNav: { paddingHorizontal: 12, paddingTop: 8, gap: 2 },
  navItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  navItemActive: { borderLeftColor: ACCENT, backgroundColor: 'rgba(201,168,76,0.07)' },
  navLabel: { fontSize: 14, color: MUTED },
  navLabelActive: { color: INK, fontWeight: '600' },
  helpPin: { paddingHorizontal: 20, paddingTop: 12 },
  helpPinText: { fontSize: 12, color: MUTED },

  // ── Narrow top strip ────────────────────────────────────────────────────
  topStrip: {
    backgroundColor: NAVY,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  stripRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingBottom: 10,
  },
  brandMarkNarrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: ACCENT, textTransform: 'uppercase' },
  venueNarrow: { fontSize: 13, fontWeight: '600', color: palette.cream, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statChip: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: palette.cream, lineHeight: 20 },
  statLabel: { fontSize: 9, color: 'rgba(245,240,232,0.55)', textTransform: 'lowercase' },
  topTabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  topTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  topTabActive: { borderBottomColor: ACCENT },
  topTabLabel: { fontSize: 13, color: 'rgba(245,240,232,0.55)' },
  topTabLabelActive: { color: palette.cream, fontWeight: '600' },

  // ── Workspace ────────────────────────────────────────────────────────────
  workspace: { flex: 1, backgroundColor: '#fff' },
})
