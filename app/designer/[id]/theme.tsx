// Designer — Theme: paper color, ink color, stamp art style.
import React, { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useDesigner } from './_layout'
import { palette } from '../../../lib/colors'

const MUTED   = palette.muted
const HAIRLINE = palette.hairline
const INK     = palette.ink

const PAPERS = [palette.paper,'#f0ece3','#e8f0e8','#e8ecf4','#f4ece8','#fff']
const INKS   = [palette.ink,palette.navy,'#2e3a1f','#1a1a2e','#2e1a1a']

export default function ThemeRoute() {
  const { passport, save, saving } = useDesigner()
  const [paper, setPaper] = useState(passport?.paper_color ?? palette.paper)
  const [illus, setIllus] = useState(passport?.illus_color ?? palette.accent)
  const [opacity, setOpacity] = useState(String(passport?.illus_opacity ?? 0.15))

  if (!passport) return null

  const handleSave = () => save({
    paper_color: paper,
    illus_color: illus,
    illus_opacity: parseFloat(opacity) || 0.15,
  })

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <SwatchRow label="Paper color" colors={PAPERS} value={paper} onChange={setPaper} />
      <SwatchRow label="Illustration color" colors={INKS} value={illus} onChange={setIllus} />

      <View style={s.field}>
        <Text style={s.label}>Illustration opacity (0–1)</Text>
        <TextInput
          style={s.input}
          value={opacity}
          onChangeText={setOpacity}
          keyboardType="decimal-pad"
          placeholder="0.15"
          placeholderTextColor={HAIRLINE}
        />
      </View>

      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save theme'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function SwatchRow({ label, colors, value, onChange }: {
  label: string; colors: string[]; value: string; onChange: (c: string) => void
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.swatches}>
        {colors.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.swatch, { backgroundColor: c }, value === c && s.swatchActive]}
            onPress={() => onChange(c)}
          />
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.cream },
  content: { padding: 28, paddingBottom: 48 },
  field: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: MUTED, marginBottom: 8, textTransform: 'uppercase' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 4, borderWidth: 1.5, borderColor: HAIRLINE },
  swatchActive: { borderColor: INK },
  input: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4,
    padding: 10, fontSize: 14, color: INK, backgroundColor: '#fff', width: 120,
  },
  saveBtn: {
    backgroundColor: palette.green, borderRadius: 4, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
