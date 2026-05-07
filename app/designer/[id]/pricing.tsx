// Designer — Pricing & redemption rules.
import React, { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { useDesigner } from './_layout'

const INK     = '#1f1d1a'
const MUTED   = '#6b6356'
const HAIRLINE = '#c8bfa9'
const ACCENT  = '#c9a84c'

export default function PricingRoute() {
  const { passport, save, saving } = useDesigner()
  const [isFree, setIsFree] = useState(passport?.is_free ?? true)
  const [priceCents, setPriceCents] = useState(String((passport?.price_cents ?? 0) / 100))

  if (!passport) return null

  const handleSave = () => save({
    is_free: isFree,
    price_cents: isFree ? 0 : Math.round(parseFloat(priceCents || '0') * 100),
  })

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Pricing</Text>
      <Text style={s.hint}>
        Free passports are accessible to all collectors.
        Paid passports require purchase before stamping.
      </Text>

      <View style={s.row}>
        <Text style={s.rowLabel}>Free passport</Text>
        <Switch
          value={isFree}
          onValueChange={setIsFree}
          trackColor={{ false: HAIRLINE, true: ACCENT }}
          thumbColor={isFree ? INK : '#f4f3f4'}
        />
      </View>

      {!isFree && (
        <View style={s.field}>
          <Text style={s.label}>Price (USD)</Text>
          <View style={s.priceRow}>
            <Text style={s.currencySymbol}>$</Text>
            <TextInput
              style={s.priceInput}
              value={priceCents}
              onChangeText={setPriceCents}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={HAIRLINE}
            />
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save pricing'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 28, paddingBottom: 48 },
  heading: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 8 },
  hint: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#ebe2cd',
  },
  rowLabel: { fontSize: 15, color: INK },
  field: { marginTop: 16, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: MUTED, marginBottom: 6, textTransform: 'uppercase' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currencySymbol: { fontSize: 18, color: MUTED },
  priceInput: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4,
    padding: 10, fontSize: 18, color: INK, backgroundColor: '#fff', width: 120,
  },
  saveBtn: {
    backgroundColor: '#1d9e75', borderRadius: 4, padding: 14,
    alignItems: 'center', marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
