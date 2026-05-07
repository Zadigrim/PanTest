// Designer — Cover editor.
import React, { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { useDesigner } from './_layout'

const INK     = '#1f1d1a'
const MUTED   = '#6b6356'
const ACCENT  = '#c9a84c'
const HAIRLINE = '#c8bfa9'

const PALETTE = ['#2E7D4D','#0d1b2a','#9b2335','#2d5a8e','#7a5c2e','#444','#f5f0e8']

export default function CoverRoute() {
  const { passport, save, saving } = useDesigner()
  const [title, setTitle] = useState(passport?.title ?? '')
  const [desc, setDesc] = useState(passport?.description ?? '')
  const [emblem, setEmblem] = useState(passport?.cover_emblem ?? '🧭')
  const [bgColor, setBgColor] = useState(passport?.cover_bg_color ?? '#2E7D4D')

  if (!passport) return null

  const handleSave = () => save({
    title,
    description: desc || null,
    cover_emblem: emblem,
    cover_bg_color: bgColor,
  })

  return (
    <View style={s.container}>
      {/* Live cover preview */}
      <View style={[s.preview, { backgroundColor: bgColor }]}>
        <Text style={s.previewEmblem}>{emblem}</Text>
        <Text style={s.previewTitle}>{title || 'Untitled'}</Text>
      </View>

      {/* Form */}
      <ScrollView style={s.form} contentContainerStyle={s.formContent}>
        <Field label="Title">
          <Input value={title} onChangeText={setTitle} placeholder="Passport title" />
        </Field>
        <Field label="Description">
          <Input value={desc} onChangeText={setDesc} placeholder="Short description" multiline />
        </Field>
        <Field label="Cover emblem">
          <Input value={emblem} onChangeText={setEmblem} maxLength={2} style={{ fontSize: 24, textAlign: 'center' }} />
        </Field>
        <Field label="Background color">
          <View style={s.palette}>
            {PALETTE.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.swatch, { backgroundColor: c }, bgColor === c && s.swatchActive]}
                onPress={() => setBgColor(c)}
              />
            ))}
          </View>
        </Field>

        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save cover'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  )
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={[s.input, props.multiline && s.inputMulti, props.style as any]}
      placeholderTextColor={HAIRLINE}
      {...props}
    />
  )
}

const s = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#e8e1d2' },
  preview: {
    width: 180, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: HAIRLINE, gap: 12, padding: 24,
  },
  previewEmblem: { fontSize: 40 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#f5f0e8', textAlign: 'center' },
  form: { flex: 1, backgroundColor: '#f5f0e8' },
  formContent: { padding: 24, gap: 0, paddingBottom: 48 },
  field: { marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: MUTED, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4,
    padding: 10, fontSize: 14, color: INK, backgroundColor: '#fff',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 4, borderWidth: 1.5, borderColor: 'transparent' },
  swatchActive: { borderColor: INK },
  saveBtn: {
    backgroundColor: '#1d9e75', borderRadius: 4, padding: 14,
    alignItems: 'center', marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
