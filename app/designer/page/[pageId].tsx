// Page editor — creator edits section metadata and manages stops.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import type { PassportPage, Stop } from '../../../types'
import { palette } from '../../../lib/colors'

export default function PageEditorScreen() {
  const { pageId } = useLocalSearchParams<{ pageId: string }>()
  const [page, setPage] = useState<PassportPage | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: pageData } = await supabase
      .from('passport_pages')
      .select('*')
      .eq('id', pageId)
      .single()

    const { data: stopsData } = await supabase
      .from('stops')
      .select('*')
      .eq('page_id', pageId)
      .order('stop_order')

    setPage(pageData)
    setStops(stopsData ?? [])
    setLoading(false)
  }, [pageId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async () => {
    if (!page) return
    setSaving(true)
    const { error } = await supabase
      .from('passport_pages')
      .update({
        section_name: page.section_name,
        section_tagline: page.section_tagline,
        prize_description: page.prize_description,
      })
      .eq('id', pageId)
    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved')
    }
  }, [page, pageId])

  const addStop = useCallback(async () => {
    const { data, error } = await supabase
      .from('stops')
      .insert({
        page_id: pageId,
        stop_order: stops.length + 1,
        name: 'New Stop',
        stamp_icon: '📍',
        stamp_color: palette.green,
        stamp_shape: 'circle',
        stamp_smudge: 'light',
        evidence_tier: 3,
        radius_meters: 150,
      })
      .select()
      .single()

    if (!error && data) {
      router.push(`/designer/stop/${data.id}`)
    }
  }, [pageId, stops.length])

  const deleteStop = useCallback((stopId: string) => {
    Alert.alert('Delete stop', 'Remove this stop from the page?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('stops').delete().eq('id', stopId)
          setStops((prev) => prev.filter((s) => s.id !== stopId))
        },
      },
    ])
  }, [])

  if (loading || !page) {
    return <View style={styles.centered}><ActivityIndicator color={palette.accent} /></View>
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Section settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Section settings</Text>

        <Text style={styles.label}>Section name</Text>
        <TextInput
          style={styles.input}
          value={page.section_name}
          onChangeText={(t) => setPage((p) => p ? { ...p, section_name: t } : p)}
          placeholder="e.g. North Portland"
        />

        <Text style={styles.label}>Tagline (optional)</Text>
        <TextInput
          style={styles.input}
          value={page.section_tagline ?? ''}
          onChangeText={(t) => setPage((p) => p ? { ...p, section_tagline: t || null } : p)}
          placeholder="e.g. Historic brewpubs & theaters"
        />

        <Text style={styles.label}>Prize description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={page.prize_description ?? ''}
          onChangeText={(t) => setPage((p) => p ? { ...p, prize_description: t || null } : p)}
          placeholder="e.g. One free pint at any McMenamins location"
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save section'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stops */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stops ({stops.length})</Text>

        {stops.map((stop, i) => (
          <View key={stop.id} style={styles.stopRow}>
            <TouchableOpacity
              style={styles.stopRowMain}
              onPress={() => router.push(`/designer/stop/${stop.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.stopIndexBadge}>
                <Text style={styles.stopIndex}>{i + 1}</Text>
              </View>
              <View style={styles.stopIcon}>
                <Text style={styles.stopEmoji}>{stop.stamp_icon}</Text>
              </View>
              <View style={styles.stopBody}>
                <Text style={styles.stopName}>{stop.name}</Text>
                {stop.location_name ? (
                  <Text style={styles.stopLocation}>{stop.location_name}</Text>
                ) : null}
                <Text style={styles.stopMeta}>
                  {stop.stamp_shape} · tier {stop.evidence_tier}
                </Text>
              </View>
              <Text style={styles.stopArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deleteStop(stop.id)}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addStop}>
          <Text style={styles.addBtnText}>+ Add stop</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12,
    padding: 16, marginBottom: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: palette.navy, marginBottom: 12 },
  label: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    padding: 10, fontSize: 15, color: '#222',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: palette.navy, borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: palette.cream, fontWeight: '700', fontSize: 14 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  stopRowMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
  },
  stopIndexBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  stopIndex: { fontSize: 10, color: '#888', fontWeight: '600' },
  stopIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  stopEmoji: { fontSize: 18 },
  stopBody: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '600', color: palette.navy },
  stopLocation: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  stopMeta: { fontSize: 10, color: '#bbb', marginTop: 1 },
  stopArrow: { fontSize: 18, color: '#ccc', paddingHorizontal: 4 },
  deleteBtn: {
    padding: 10, paddingLeft: 4,
  },
  deleteBtnText: { fontSize: 14, color: '#C0392B' },
  addBtn: { paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: palette.green, fontWeight: '600', fontSize: 14 },
})
