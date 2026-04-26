import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Image, StyleSheet, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { MoodRating } from './MoodRating'
import { VoiceRecorder } from './VoiceRecorder'
import type { InputMethod } from '../../types'

interface Props {
  stampId: string
  userId: string
  existingBody?: string
  existingMood?: number | null
  existingPhotos?: string[]
  onSaved: () => void
}

export function JournalEntry({ stampId, userId, existingBody = '', existingMood = null, existingPhotos = [], onSaved }: Props) {
  const [body, setBody] = useState(existingBody)
  const [mood, setMood] = useState<number | null>(existingMood)
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const [inputMethod, setInputMethod] = useState<InputMethod>('keyboard')
  const [saving, setSaving] = useState(false)
  const [showVoice, setShowVoice] = useState(false)

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    })
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)])
    }
  }, [])

  const handleVoiceTranscript = useCallback((text: string) => {
    setBody((prev) => {
      const updated = prev ? `${prev} ${text}`.trim() : text
      return updated
    })
    setInputMethod((m) => (m === 'keyboard' ? 'voice' : 'both'))
  }, [])

  const handleTextChange = useCallback((text: string) => {
    setBody(text)
    setInputMethod((m) => (m === 'voice' ? 'both' : 'keyboard'))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)

    const payload = {
      stamp_id: stampId,
      user_id: userId,
      body: body || null,
      mood_rating: mood,
      photo_urls: photos,
      input_method: inputMethod,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('journal_entries')
      .upsert(payload, { onConflict: 'stamp_id' })

    setSaving(false)
    if (error) {
      Alert.alert('Error', 'Could not save journal entry.')
    } else {
      onSaved()
    }
  }, [stampId, userId, body, mood, photos, inputMethod, onSaved])

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <MoodRating value={mood} onChange={setMood} />

      {/* Voice toggle */}
      <TouchableOpacity
        onPress={() => setShowVoice((v) => !v)}
        style={styles.voiceToggle}
      >
        <Text style={styles.voiceToggleText}>
          {showVoice ? '⌨ Type instead' : '🎤 Use voice'}
        </Text>
      </TouchableOpacity>

      {showVoice && (
        <VoiceRecorder onTranscriptUpdate={handleVoiceTranscript} />
      )}

      <TextInput
        style={styles.textInput}
        multiline
        placeholder="Write about your experience…"
        placeholderTextColor="#bbb"
        value={body}
        onChangeText={handleTextChange}
        textAlignVertical="top"
      />

      {/* Photo strip */}
      {photos.length > 0 && (
        <ScrollView horizontal style={styles.photoStrip} showsHorizontalScrollIndicator={false}>
          {photos.map((uri, i) => (
            <TouchableOpacity key={i} onLongPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
              <Image source={{ uri }} style={styles.photo} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity onPress={pickPhoto} style={styles.photoBtn}>
        <Text style={styles.photoBtnText}>+ Add photo</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save entry'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  voiceToggle: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 6,
  },
  voiceToggleText: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 140,
    color: '#222',
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  photoStrip: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 8,
  },
  photoBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  photoBtnText: {
    color: '#666',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
})
