// Reading recommendation screen — library employees only.
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'
import { LandscapeContainer } from '../../components/layout/LandscapeContainer'

const NOTE_MAX = 200

export default function RecommendScreen() {
  const { stampId, userId, stopId } = useLocalSearchParams<{
    stampId: string
    userId: string
    stopId: string
  }>()
  const { employeeAuth, catalogUrl } = useEmployeeContext()

  const [bookTitle, setBookTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [note, setNote] = useState('')
  const [catalog, setCatalog] = useState(catalogUrl ?? '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!bookTitle.trim()) {
      Alert.alert('Title required', 'Enter the book title.')
      return
    }
    if (!author.trim()) {
      Alert.alert('Author required', 'Enter the author name.')
      return
    }

    setSubmitting(true)
    const user = await getCurrentUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { error } = await supabase.from('reading_recommendations').insert({
      stamp_id: stampId,
      user_id: userId,
      recommended_by: user.id,
      recommender_role: 'employee',
      title: bookTitle.trim(),
      author: author.trim() || null,
      catalog_url: catalog.trim() || null,
      note: note.trim() || null,
    })

    setSubmitting(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    router.replace('/(tabs)/field')
  }

  return (
    <LandscapeContainer>
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Recommend a book</Text>

        <Text style={styles.fieldLabel}>Book title *</Text>
        <TextInput
          style={styles.input}
          value={bookTitle}
          onChangeText={setBookTitle}
          placeholder="Title"
          placeholderTextColor="#555"
          returnKeyType="next"
        />

        <Text style={styles.fieldLabel}>Author *</Text>
        <TextInput
          style={styles.input}
          value={author}
          onChangeText={setAuthor}
          placeholder="Author name"
          placeholderTextColor="#555"
          returnKeyType="next"
        />

        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
          placeholder="Why this book for this visitor?"
          placeholderTextColor="#555"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{note.length} / {NOTE_MAX}</Text>

        <Text style={styles.fieldLabel}>Catalog URL (optional)</Text>
        <TextInput
          style={styles.input}
          value={catalog}
          onChangeText={setCatalog}
          placeholder="https://catalog.library.org/..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !bookTitle.trim() || !author.trim()) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !bookTitle.trim() || !author.trim()}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={palette.navy} />
            : <Text style={styles.submitBtnText}>Add recommendation</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </LandscapeContainer>
  )
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: palette.navy },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  pageTitle: {
    fontSize: 22, color: palette.cream, fontFamily: 'serif', marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 11, color: palette.accent, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    backgroundColor: '#152232', borderRadius: 10, padding: 14,
    color: palette.cream, fontSize: 15, borderWidth: 1, borderColor: '#1a2d44',
    marginBottom: 18,
  },
  noteInput: { minHeight: 80 },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: -14, marginBottom: 18 },
  submitBtn: {
    backgroundColor: palette.green, borderRadius: 10, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghostBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { color: '#555', fontSize: 14 },
})
