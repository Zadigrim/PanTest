// Stop editor — creator configures all stop fields and previews the stamp.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { StampArtwork } from '../../../components/stamp/StampArtwork'
import type { Stop, StampShape, StampSmudge, VerificationType } from '../../../types'

const SHAPE_OPTIONS: StampShape[] = ['circle', 'rectangle', 'hexagon', 'badge']
const SMUDGE_OPTIONS: StampSmudge[] = ['none', 'light', 'medium', 'heavy']
const VERIFICATION_OPTIONS: VerificationType[] = ['presence', 'witnessed', 'documented', 'honor']
const PRESET_COLORS = [
  '#1D9E75', '#0D1B2A', '#C9A84C', '#C0392B', '#2980B9',
  '#8E44AD', '#E67E22', '#27AE60', '#2C3E50', '#7F8C8D',
]

function OptionRow<T extends string>({
  label, options, value, onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.optionBtn, value === opt && styles.optionBtnActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.optionBtnText, value === opt && styles.optionBtnTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function StopEditorScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>()
  const [stop, setStop] = useState<Stop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('stops').select('*').eq('id', stopId).single()
      setStop(data)
      setLoading(false)
    }
    load()
  }, [stopId])

  const set = useCallback(<K extends keyof Stop>(key: K, value: Stop[K]) => {
    setStop((prev) => prev ? { ...prev, [key]: value } : prev)
  }, [])

  const save = useCallback(async () => {
    if (!stop) return
    setSaving(true)
    const { error } = await supabase
      .from('stops')
      .update({
        name: stop.name,
        year_established: stop.year_established,
        location_name: stop.location_name,
        description: stop.description,
        evidence_tier: stop.evidence_tier,
        radius_meters: stop.radius_meters,
        qr_code_id: stop.qr_code_id,
        stamp_icon: stop.stamp_icon,
        stamp_color: stop.stamp_color,
        stamp_shape: stop.stamp_shape,
        stamp_smudge: stop.stamp_smudge,
        stamp_rotation_range: stop.stamp_rotation_range,
        verification_type: stop.verification_type,
      })
      .eq('id', stopId)

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved', '', [{ text: 'OK', onPress: () => router.back() }])
    }
  }, [stop, stopId])

  const generateQrId = useCallback(() => {
    const id = 'QR-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    set('qr_code_id', id)
  }, [set])

  if (loading || !stop) {
    return <View style={styles.centered}><ActivityIndicator color="#C9A84C" /></View>
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Stamp preview */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Stamp preview</Text>
        <StampArtwork stop={stop} size={100} rotationDeg={0} ghost={false} />
      </View>

      {/* Location info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location info</Text>

        <Text style={styles.label}>Stop name *</Text>
        <TextInput
          style={styles.input}
          value={stop.name}
          onChangeText={(t) => set('name', t)}
          placeholder="e.g. Kennedy School"
        />

        <Text style={styles.label}>Location name</Text>
        <TextInput
          style={styles.input}
          value={stop.location_name ?? ''}
          onChangeText={(t) => set('location_name', t || null)}
          placeholder="e.g. NE Portland"
        />

        <Text style={styles.label}>Year established</Text>
        <TextInput
          style={styles.input}
          value={stop.year_established ?? ''}
          onChangeText={(t) => set('year_established', t || null)}
          placeholder="e.g. 1915"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={stop.description ?? ''}
          onChangeText={(t) => set('description', t || null)}
          placeholder="Brief description of the location…"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Verification */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification</Text>

        <Text style={styles.label}>Evidence tier (1 = strictest, 5 = honor system)</Text>
        <View style={styles.tierRow}>
          {[1, 2, 3, 4, 5].map((tier) => (
            <TouchableOpacity
              key={tier}
              style={[styles.tierBtn, stop.evidence_tier === tier && styles.tierBtnActive]}
              onPress={() => set('evidence_tier', tier)}
            >
              <Text style={[styles.tierBtnText, stop.evidence_tier === tier && styles.tierBtnTextActive]}>
                {tier}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.tierHint}>
          {stop.evidence_tier === 1 ? '1 — GPS + QR scan required'
            : stop.evidence_tier === 2 ? '2 — QR + GPS radius'
            : stop.evidence_tier === 3 ? '3 — GPS radius only'
            : stop.evidence_tier === 4 ? '4 — Employee verification'
            : '5 — Honor system (self-reported)'}
        </Text>

        <Text style={styles.label}>GPS radius (meters)</Text>
        <TextInput
          style={styles.input}
          value={String(stop.radius_meters)}
          onChangeText={(t) => set('radius_meters', parseFloat(t) || 150)}
          keyboardType="numeric"
        />

        <OptionRow
          label="Verification type"
          options={VERIFICATION_OPTIONS}
          value={stop.verification_type ?? 'presence'}
          onChange={(v) => set('verification_type', v)}
        />

        <Text style={styles.label}>QR code ID</Text>
        <View style={styles.qrRow}>
          <TextInput
            style={[styles.input, styles.qrInput]}
            value={stop.qr_code_id ?? ''}
            onChangeText={(t) => set('qr_code_id', t || null)}
            placeholder="Leave empty for GPS-only"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.qrGenBtn} onPress={generateQrId}>
            <Text style={styles.qrGenBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stamp appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stamp appearance</Text>

        <Text style={styles.label}>Icon (emoji)</Text>
        <TextInput
          style={[styles.input, styles.emojiInput]}
          value={stop.stamp_icon}
          onChangeText={(t) => set('stamp_icon', t)}
          maxLength={2}
        />

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                stop.stamp_color === color && styles.colorSwatchActive,
              ]}
              onPress={() => set('stamp_color', color)}
            />
          ))}
        </View>

        <OptionRow
          label="Shape"
          options={SHAPE_OPTIONS}
          value={stop.stamp_shape}
          onChange={(v) => set('stamp_shape', v)}
        />

        <OptionRow
          label="Smudge / ink texture"
          options={SMUDGE_OPTIONS}
          value={stop.stamp_smudge}
          onChange={(v) => set('stamp_smudge', v)}
        />

        <Text style={styles.label}>Rotation range (±degrees)</Text>
        <TextInput
          style={styles.input}
          value={String(stop.stamp_rotation_range ?? 5)}
          onChangeText={(t) => set('stamp_rotation_range', parseFloat(t) || 0)}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save stop'}</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewCard: {
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  previewLabel: { color: '#C9A84C', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  section: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12,
    padding: 16, marginBottom: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0D1B2A', marginBottom: 8 },
  label: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    padding: 10, fontSize: 15, color: '#222',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  emojiInput: { fontSize: 28, textAlign: 'center', width: 64, padding: 8 },
  tierRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tierBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#ddd',
    alignItems: 'center', justifyContent: 'center',
  },
  tierBtnActive: { backgroundColor: '#0D1B2A', borderColor: '#0D1B2A' },
  tierBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  tierBtnTextActive: { color: '#fff' },
  tierHint: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 6 },
  optionGroup: { marginTop: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  optionBtnActive: { backgroundColor: '#0D1B2A', borderColor: '#0D1B2A' },
  optionBtnText: { fontSize: 12, color: '#555' },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
  qrRow: { flexDirection: 'row', gap: 8, marginTop: 0, alignItems: 'center' },
  qrInput: { flex: 1 },
  qrGenBtn: {
    backgroundColor: '#1D9E75', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  qrGenBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  saveBtn: {
    backgroundColor: '#0D1B2A', borderRadius: 12, margin: 16,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#F5F0E8', fontWeight: '700', fontSize: 16 },
  bottomSpacer: { height: 16 },
})
