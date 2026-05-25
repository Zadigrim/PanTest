// Accolade composition screen — employee gives a commendation to a collector.
import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'

const NOTE_MAX = 280

const GENERAL_TITLES = [
  'Sharp Eyes',
  'Good Question',
  'Made the Connection',
  'Looked Twice',
  'Curious Naturalist',
]

const LIBRARY_TITLES = [
  'Deep Reader',
  'History Detective',
  'Future Scholar',
]

const PARK_TITLES = [
  'Future Ranger',
  'Trail Expert',
  'Nature Spotter',
]

function getTitles(institutionType: string | null): string[] {
  const titles = [...GENERAL_TITLES]
  if (institutionType === 'library') titles.push(...LIBRARY_TITLES)
  if (institutionType === 'park' || institutionType === 'outdoor') titles.push(...PARK_TITLES)
  return titles
}

export default function AccoladeScreen() {
  const { stampId, userId, stopId } = useLocalSearchParams<{
    stampId: string
    userId: string
    stopId: string
  }>()
  const { employeeAuth, institutionType } = useEmployeeContext()

  const [titles] = useState(() => getTitles(institutionType))
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [note, setNote] = useState('')
  const [giver, setGiver] = useState('')
  const [collectorName, setCollectorName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Load giver and collector names for preview
    const loadNames = async () => {
      const user = await getCurrentUser()
      if (!user) return

      const [{ data: giverProfile }, { data: collectorProfile }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('profiles').select('display_name').eq('id', userId).single(),
      ])

      if (giverProfile) setGiver(giverProfile.display_name)
      if (collectorProfile) setCollectorName(collectorProfile.display_name.split(' ')[0])
    }
    loadNames()
  }, [userId])

  const effectiveTitle = isCustom ? customTitle : (selectedTitle ?? '')

  const handleSubmit = async () => {
    if (!effectiveTitle.trim()) {
      Alert.alert('Select a title', 'Choose or write a title for this accolade.')
      return
    }

    setSubmitting(true)
    const user = await getCurrentUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: newAccolade, error: insertError } = await supabase
      .from('accolades')
      .insert({
        stamp_id: stampId,
        stop_id: stopId,
        user_id: userId,
        given_by: user.id,
        giver_role: 'employee',
        giver_institution: employeeAuth?.institution_name ?? null,
        title: effectiveTitle.trim(),
        note: note.trim() || null,
      })
      .select('id')
      .single()

    if (insertError || !newAccolade) {
      Alert.alert('Error', insertError?.message ?? 'Could not save accolade.')
      setSubmitting(false)
      return
    }

    // Update stamp with accolade reference
    await supabase
      .from('stamps')
      .update({ has_accolade: true, accolade_id: newAccolade.id })
      .eq('id', stampId)

    setSubmitting(false)
    router.replace('/(tabs)/field')
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section 1: Title selector */}
      <Text style={styles.sectionLabel}>Choose a title</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {titles.map((t) => {
          const active = !isCustom && selectedTitle === t
          return (
            <TouchableOpacity
              key={t}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setSelectedTitle(t); setIsCustom(false) }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity
          style={[styles.chip, isCustom && styles.chipActive]}
          onPress={() => setIsCustom(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, isCustom && styles.chipTextActive]}>Write your own</Text>
        </TouchableOpacity>
      </ScrollView>

      {isCustom && (
        <TextInput
          style={styles.customInput}
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder="e.g. Wildflower Expert"
          placeholderTextColor="#555"
          maxLength={60}
          returnKeyType="done"
        />
      )}

      {/* Section 2: Note */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Add a note (optional)</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
        placeholder="What made this visitor stand out?"
        placeholderTextColor="#555"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{note.length} / {NOTE_MAX}</Text>

      {/* Section 3: Preview */}
      {effectiveTitle.trim() !== '' && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewTitle}>{effectiveTitle}</Text>
          {note.trim() !== '' && (
            <Text style={styles.previewNote}>"{note.trim()}"</Text>
          )}
          <View style={styles.previewFooter}>
            <Text style={styles.previewGiver}>
              {giver}{employeeAuth?.institution_name ? ` · ${employeeAuth.institution_name}` : ''}
            </Text>
            <Text style={styles.previewTo}>
              to {collectorName || 'visitor'}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (!effectiveTitle.trim() || submitting) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!effectiveTitle.trim() || submitting}
        activeOpacity={0.85}
      >
        {submitting
          ? <ActivityIndicator color={palette.navy} />
          : <Text style={styles.submitBtnText}>Give this accolade.</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, color: palette.accent, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
  },
  chipScroll: { marginHorizontal: -20 },
  chipRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  chip: {
    borderWidth: 1, borderColor: '#1a2d44', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#152232',
  },
  chipActive: { borderColor: palette.accent, backgroundColor: palette.accent },
  chipText: { color: '#888', fontSize: 14 },
  chipTextActive: { color: palette.navy, fontWeight: '700' },
  customInput: {
    backgroundColor: '#152232', borderRadius: 10, padding: 14,
    color: palette.cream, fontSize: 16, borderWidth: 1, borderColor: palette.accent,
    marginTop: 10,
  },
  noteInput: {
    backgroundColor: '#152232', borderRadius: 10, padding: 14,
    color: palette.cream, fontSize: 15, borderWidth: 1, borderColor: '#1a2d44',
    minHeight: 100,
  },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: 6 },
  previewCard: {
    backgroundColor: '#152232', borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: palette.accent, marginTop: 24,
  },
  previewLabel: {
    fontSize: 10, color: palette.accent, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
  },
  previewTitle: {
    fontSize: 22, color: palette.cream, fontFamily: 'serif', fontWeight: '700', marginBottom: 8,
  },
  previewNote: {
    fontSize: 14, color: '#aaa', fontStyle: 'italic', lineHeight: 20, marginBottom: 12,
  },
  previewFooter: { borderTopWidth: 1, borderTopColor: '#1a2d44', paddingTop: 10 },
  previewGiver: { fontSize: 12, color: '#888' },
  previewTo: { fontSize: 12, color: '#666', marginTop: 2 },
  submitBtn: {
    backgroundColor: palette.accent, borderRadius: 10, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: palette.navy, fontWeight: '700', fontSize: 16 },
})
