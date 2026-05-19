// Employee Terminal — Help screen (placeholder).
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

const INK   = '#1f1d1a'
const MUTED = '#6b6356'
const ACCENT = '#c9a84c'
const HAIRLINE = '#c8bfa9'

const ITEMS = [
  {
    q: 'How do I scan a token?',
    a: 'Point the camera at the QR code on the collector\'s phone. The app will detect it automatically. If the camera isn\'t working, type the code in the "Or type" box.',
  },
  {
    q: 'What are the three outcome buttons?',
    a: '"Given" — you\'ve handed the prize to the collector right now. "Pending" — the collector is coming back later, or a manager will distribute. "Refused" — the prize was unavailable or the request was invalid.',
  },
  {
    q: 'Can I go back from Step 2?',
    a: 'No. Step 2 is required for audit purposes. You must select an outcome before returning to the scanner.',
  },
  {
    q: 'What does "Pending" mean for the counter?',
    a: '"Pending" counts redemptions that have been scanned but not yet fully distributed. Follow up with collectors or your manager to clear them.',
  },
  {
    q: 'Who do I contact for issues?',
    a: 'Contact your venue manager or reach Okuji support at nathan.app.',
  },
]

export default function HelpScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Employee Terminal Help</Text>
      <Text style={s.intro}>
        The Employee Terminal is a two-step audited redemption tool.
        Every scan and every outcome is logged separately for accountability.
      </Text>
      {ITEMS.map(({ q, a }, i) => (
        <View key={i} style={s.item}>
          <Text style={s.question}>{q}</Text>
          <Text style={s.answer}>{a}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 28, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 10 },
  intro: {
    fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#f0ece3',
  },
  item: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  question: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 6 },
  answer: { fontSize: 13, color: MUTED, lineHeight: 20 },
})
