// Full recent-redemptions list for this employee, today.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'

const INK     = '#1f1d1a'
const MUTED   = '#6b6356'
const ACCENT  = '#c9a84c'
const GREEN   = '#1d9e75'
const HAIRLINE = '#c8bfa9'

interface Item {
  id: string
  token_code: string
  prize_given: string | null
  scanned_at: string | null
  prize_distributed_at: string | null
  distribution_pending: boolean
}

export default function RecentScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const user = await getCurrentUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: acct } = await supabase
      .from('employee_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (!acct) { setLoading(false); return }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('redemption_tokens')
      .select('id, token_code, prize_given, scanned_at, prize_distributed_at, distribution_pending')
      .eq('scanned_by_employee', acct.id)
      .gte('scanned_at', today.toISOString())
      .order('scanned_at', { ascending: false })
      .limit(100)

    setItems((data ?? []) as Item[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.heading}>Today's scans</Text>
        <Text style={s.count}>{items.length} total</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={items.length === 0 && s.emptyWrap}
        ListEmptyComponent={
          <Text style={s.emptyText}>No scans today.</Text>
        }
        renderItem={({ item }) => {
          const dot = item.prize_distributed_at && !item.distribution_pending
            ? GREEN : item.distribution_pending ? ACCENT : HAIRLINE
          const status = item.prize_distributed_at && !item.distribution_pending
            ? 'Given'
            : item.distribution_pending ? 'Pending'
            : 'Scanned'
          return (
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: dot }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.tokenCode}>{item.token_code}</Text>
                {!!item.prize_given && (
                  <Text style={s.prize}>{item.prize_given}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={[s.statusChip, { color: dot }]}>{status}</Text>
                {!!item.scanned_at && (
                  <Text style={s.time}>
                    {new Date(item.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </View>
          )
        }}
        ItemSeparatorComponent={() => <View style={s.sep} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0ece3',
  },
  heading: { fontSize: 16, fontWeight: '700', color: INK },
  count: { fontSize: 12, color: MUTED },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tokenCode: { fontSize: 13, fontWeight: '600', color: INK, fontFamily: 'monospace', letterSpacing: 1 },
  prize: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusChip: { fontSize: 11, fontWeight: '600' },
  time: { fontSize: 10, color: HAIRLINE },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: HAIRLINE, marginLeft: 44 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: HAIRLINE, fontStyle: 'italic' },
})
