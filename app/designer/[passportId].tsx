// Passport editor — creator configures title, pages, stops, appearance.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { Passport, PassportPage, Stop } from '../../types'

export default function PassportEditorScreen() {
  const { passportId } = useLocalSearchParams<{ passportId: string }>()
  const [passport, setPassport] = useState<Passport | null>(null)
  const [pages, setPages] = useState<PassportPage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('passports').select('*').eq('id', passportId).single()
      const { data: pg } = await supabase
        .from('passport_pages')
        .select('*')
        .eq('passport_id', passportId)
        .order('page_order')
      setPassport(p)
      setPages(pg ?? [])
      setLoading(false)
    }
    load()
  }, [passportId])

  const save = useCallback(async () => {
    if (!passport) return
    setSaving(true)
    await supabase.from('passports').update({
      title: passport.title,
      description: passport.description,
      is_published: passport.is_published,
      cover_bg_color: passport.cover_bg_color,
      cover_emblem: passport.cover_emblem,
      paper_color: passport.paper_color,
      illus_color: passport.illus_color,
      illus_opacity: passport.illus_opacity,
    }).eq('id', passportId)
    setSaving(false)
    Alert.alert('Saved')
  }, [passport, passportId])

  const addPage = useCallback(async () => {
    const { data } = await supabase
      .from('passport_pages')
      .insert({
        passport_id: passportId,
        page_order: pages.length + 1,
        section_name: `Section ${pages.length + 1}`,
      })
      .select()
      .single()
    if (data) setPages((p) => [...p, data])
  }, [passportId, pages.length])

  if (loading || !passport) return <View style={styles.centered}><ActivityIndicator color="#C9A84C" /></View>

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={passport.title}
          onChangeText={(t) => setPassport((p) => p ? { ...p, title: t } : p)}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={passport.description ?? ''}
          onChangeText={(t) => setPassport((p) => p ? { ...p, description: t } : p)}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Cover emblem</Text>
        <TextInput
          style={[styles.input, styles.emojiInput]}
          value={passport.cover_emblem ?? '🧭'}
          onChangeText={(t) => setPassport((p) => p ? { ...p, cover_emblem: t } : p)}
          maxLength={2}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Published</Text>
          <Switch
            value={passport.is_published}
            onValueChange={(v) => setPassport((p) => p ? { ...p, is_published: v } : p)}
            thumbColor={passport.is_published ? '#1D9E75' : '#ccc'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pages</Text>
        {pages.map((page, i) => (
          <View key={page.id} style={styles.pageRow}>
            <Text style={styles.pageNum}>{i + 1}</Text>
            <Text style={styles.pageName}>{page.section_name}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addPage}>
          <Text style={styles.addBtnText}>+ Add page</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save passport'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, marginBottom: 0,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0D1B2A', marginBottom: 12 },
  label: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10,
    fontSize: 15, color: '#222',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  emojiInput: { fontSize: 24, textAlign: 'center', width: 64 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  pageRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pageNum: { width: 24, fontSize: 13, color: '#aaa' },
  pageName: { fontSize: 15, color: '#222' },
  addBtn: { padding: 12, alignItems: 'center' },
  addBtnText: { color: '#1D9E75', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#0D1B2A', borderRadius: 12, margin: 16,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#F5F0E8', fontWeight: '700', fontSize: 16 },
})
