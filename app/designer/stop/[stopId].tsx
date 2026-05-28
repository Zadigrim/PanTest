// Stop editor — creator configures all stop fields and previews the stamp.
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { getCurrentLocation } from '../../../lib/gps'
import { StampArtwork } from '../../../components/stamp/StampArtwork'
import type { Stop, StampShape, StampSmudge, VerificationType } from '../../../types'
import { palette } from '../../../lib/colors'

const SHAPE_OPTIONS: StampShape[] = ['circle', 'rectangle', 'hexagon', 'badge']
const SMUDGE_OPTIONS: StampSmudge[] = ['none', 'light', 'medium', 'heavy']
const VERIFICATION_OPTIONS: VerificationType[] = ['presence', 'witnessed', 'documented', 'honor']
const PRESET_COLORS = [
  palette.green, palette.navy, palette.accent, '#C0392B', '#2980B9',
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
  // GPS inputs are edit-only: leave blank to keep the stop's existing coords.
  // On save, if both parse as numbers, target_location is written as WKT.
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)

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

    const patch: Record<string, unknown> = {
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
    }

    // Conditionally include GPS coordinates. WKT POINT(lng lat) — note order.
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      patch.target_location = `POINT(${lng} ${lat})`
    }

    const { error } = await supabase.from('stops').update(patch).eq('id', stopId)

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved', '', [{ text: 'OK', onPress: () => router.back() }])
    }
  }, [stop, stopId, latInput, lngInput])

  const useCurrentLocation = useCallback(async () => {
    setGpsBusy(true)
    const loc = await getCurrentLocation()
    setGpsBusy(false)
    if (!loc) {
      Alert.alert('Location', 'Could not read your location. Make sure location permission is granted.')
      return
    }
    setLatInput(loc.latitude.toFixed(6))
    setLngInput(loc.longitude.toFixed(6))
  }, [])

  const generateQrId = useCallback(async () => {
    // Server-side provisioning: see supabase/functions/provision-qr-token.
    // Math.random was predictable; tokens are now generated server-side via
    // crypto.getRandomValues and persisted to stops.qr_code_id before return.
    try {
      const { data, error } = await supabase.functions.invoke('provision-qr-token', {
        body: { stopId, regenerate: !!stop?.qr_code_id },
      })
      const token = (data as { token?: string } | null)?.token
      if (error || !token) {
        Alert.alert('QR token', 'Could not generate a token. Please try again.')
        return
      }
      set('qr_code_id', token)
    } catch {
      Alert.alert('QR token', 'Could not generate a token. Please try again.')
    }
  }, [stopId, stop?.qr_code_id, set])

  if (loading || !stop) {
    return <View style={styles.centered}><ActivityIndicator color={palette.accent} /></View>
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

      {/* GPS coordinates — required for GPS-verified stamps (tiers 1–3) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS coordinates</Text>
        <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 8 }}>
          Required for GPS-verified stamps (tiers 1–3). Leave blank to keep existing coordinates.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={latInput}
              onChangeText={setLatInput}
              placeholder="45.523064"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={lngInput}
              onChangeText={setLngInput}
              placeholder="-122.676483"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={useCurrentLocation}
          disabled={gpsBusy}
          style={{
            marginTop: 10, padding: 12, borderRadius: 8,
            borderWidth: 1, borderColor: palette.hairline,
            alignItems: 'center', opacity: gpsBusy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 14, color: palette.navy, fontWeight: '600' }}>
            {gpsBusy ? 'Reading location…' : '📍 Use my current location'}
          </Text>
        </TouchableOpacity>
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
    backgroundColor: palette.navy,
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  previewLabel: { color: palette.accent, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  section: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12,
    padding: 16, marginBottom: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: palette.navy, marginBottom: 8 },
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
  tierBtnActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  tierBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  tierBtnTextActive: { color: '#fff' },
  tierHint: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 6 },
  optionGroup: { marginTop: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  optionBtnActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  optionBtnText: { fontSize: 12, color: '#555' },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
  qrRow: { flexDirection: 'row', gap: 8, marginTop: 0, alignItems: 'center' },
  qrInput: { flex: 1 },
  qrGenBtn: {
    backgroundColor: palette.green, borderRadius: 8,
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
    backgroundColor: palette.navy, borderRadius: 12, margin: 16,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: palette.cream, fontWeight: '700', fontSize: 16 },
  bottomSpacer: { height: 16 },
})
