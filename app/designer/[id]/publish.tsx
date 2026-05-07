// Designer — Publish flow: checklist + one-tap publish/unpublish.
import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useDesigner } from './_layout'

const INK    = '#1f1d1a'
const MUTED  = '#6b6356'
const GREEN  = '#1d9e75'
const RED    = '#9b2335'
const ACCENT = '#c9a84c'
const HAIRLINE = '#c8bfa9'

export default function PublishRoute() {
  const { passport, pages, save, saving } = useDesigner()

  const checks = useMemo(() => [
    {
      label: 'Passport has a title',
      pass: !!(passport?.title && passport.title.trim().length > 0),
    },
    {
      label: 'At least one section (page)',
      pass: pages.length > 0,
    },
    {
      label: 'Cover color set',
      pass: !!(passport?.cover_bg_color),
    },
  ], [passport, pages])

  const allPass = checks.every(c => c.pass)
  const isPublished = passport?.is_published ?? false

  const togglePublish = () => {
    if (!allPass && !isPublished) return
    save({ is_published: !isPublished })
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>
        {isPublished ? 'Published' : 'Publish checklist'}
      </Text>
      <Text style={s.hint}>
        {isPublished
          ? 'This passport is live. Collectors can discover and stamp it.'
          : 'Complete all items before publishing.'}
      </Text>

      <View style={s.checklist}>
        {checks.map(({ label, pass }) => (
          <View key={label} style={s.checkRow}>
            <Text style={[s.checkIcon, pass ? s.pass : s.fail]}>
              {pass ? '✓' : '○'}
            </Text>
            <Text style={[s.checkLabel, !pass && s.checkLabelFail]}>{label}</Text>
          </View>
        ))}
      </View>

      {isPublished ? (
        <TouchableOpacity
          style={[s.unpublishBtn, saving && s.btnDisabled]}
          onPress={togglePublish}
          disabled={saving}
        >
          <Text style={s.unpublishBtnText}>{saving ? '…' : 'Unpublish'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.publishBtn, (!allPass || saving) && s.btnDisabled]}
          onPress={togglePublish}
          disabled={!allPass || saving}
        >
          <Text style={s.publishBtnText}>{saving ? 'Publishing…' : 'Publish passport'}</Text>
        </TouchableOpacity>
      )}

      {!allPass && !isPublished && (
        <Text style={s.blockedNote}>Complete all checklist items to enable publishing.</Text>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 28, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 8 },
  hint: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 24 },
  checklist: {
    borderWidth: 1, borderColor: HAIRLINE, borderRadius: 6,
    backgroundColor: '#fff', overflow: 'hidden', marginBottom: 24,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE,
  },
  checkIcon: { fontSize: 16, width: 20, textAlign: 'center', fontWeight: '700' },
  pass: { color: GREEN },
  fail: { color: HAIRLINE },
  checkLabel: { fontSize: 14, color: INK, flex: 1 },
  checkLabelFail: { color: MUTED },
  publishBtn: {
    backgroundColor: GREEN, borderRadius: 4, padding: 16, alignItems: 'center',
  },
  publishBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  unpublishBtn: {
    borderWidth: 1.5, borderColor: HAIRLINE, borderRadius: 4,
    padding: 16, alignItems: 'center', backgroundColor: '#fff',
  },
  unpublishBtnText: { color: MUTED, fontSize: 15, fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  blockedNote: {
    marginTop: 12, fontSize: 12, color: MUTED, textAlign: 'center', fontStyle: 'italic',
  },
})
