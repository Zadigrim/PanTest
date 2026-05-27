import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { MoodRating } from './MoodRating'
import { VoiceRecorder } from './VoiceRecorder'
import type { InputMethod, JournalPhoto } from '../../types'
import { palette } from '../../lib/colors'
import { getJournalPhotoUrl, deleteJournalPhoto } from '../../lib/journal-photos'
import {
  enqueueJournalPhoto, getQueuedUrisForEntry, retryFailedPhoto, addQueueListener,
} from '../../lib/journal-photo-queue'

interface Props {
  stampId: string
  userId: string
  existingEntryId?: string | null
  existingBody?: string
  existingMood?: number | null
  existingPhotos?: string[] // legacy local URIs not yet backfilled
  onSaved: () => void
}

interface PhotoVM {
  key: string
  photoId?: string
  storagePath?: string | null
  status?: JournalPhoto['status']
  displayUri: string | null
  legacy?: boolean
}

export function JournalEntry({
  stampId, userId, existingEntryId = null,
  existingBody = '', existingMood = null, existingPhotos = [], onSaved,
}: Props) {
  const [body, setBody] = useState(existingBody)
  const [mood, setMood] = useState<number | null>(existingMood)
  const [inputMethod, setInputMethod] = useState<InputMethod>('keyboard')
  const [saving, setSaving] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const [entryId, setEntryId] = useState<string | null>(existingEntryId)
  const [photos, setPhotos] = useState<PhotoVM[]>([])

  // Build the photo list from journal_photos rows + the local upload queue,
  // resolving signed URLs for uploaded photos.
  const refreshPhotos = useCallback(async (id: string | null) => {
    const legacy: PhotoVM[] = existingPhotos.map((uri, i) => ({
      key: `legacy-${i}`, displayUri: uri, legacy: true,
    }))
    if (!id) { setPhotos(legacy); return }

    const { data } = await supabase
      .from('journal_photos')
      .select('*')
      .eq('journal_entry_id', id)
      .order('created_at', { ascending: true })
    const rows = (data ?? []) as JournalPhoto[]
    const queued = await getQueuedUrisForEntry(id)

    const vms: PhotoVM[] = []
    for (const row of rows) {
      let displayUri: string | null = null
      if (row.status === 'uploaded' && row.storage_path) {
        displayUri = await getJournalPhotoUrl(row.storage_path)
      } else if (row.status === 'pending' || row.status === 'failed') {
        displayUri = queued[row.id] ?? null
      }
      vms.push({
        key: row.id, photoId: row.id, storagePath: row.storage_path,
        status: row.status, displayUri,
      })
    }
    setPhotos([...vms, ...legacy])
  }, [existingPhotos])

  useEffect(() => { void refreshPhotos(entryId) }, [entryId, refreshPhotos])

  // Re-render whenever the upload queue changes (e.g. an upload completes).
  useEffect(() => addQueueListener(() => { void refreshPhotos(entryId) }), [entryId, refreshPhotos])

  // Persist the entry so we have an id to attach photos to. Safe to call repeatedly.
  const ensureEntry = useCallback(async (): Promise<string | null> => {
    if (entryId) return entryId
    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(
        { stamp_id: stampId, user_id: userId, body: body || null, mood_rating: mood, input_method: inputMethod },
        { onConflict: 'stamp_id' },
      )
      .select('id')
      .single()
    if (error || !data) {
      Alert.alert('Error', 'Could not start the journal entry. Please try saving first.')
      return null
    }
    setEntryId(data.id)
    return data.id
  }, [entryId, stampId, userId, body, mood, inputMethod])

  const addPhotos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      // No quality reduction here — resizing/upload is handled by the queue.
    })
    if (result.canceled) return

    const id = await ensureEntry()
    if (!id) return

    for (const asset of result.assets) {
      try {
        await enqueueJournalPhoto(
          { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType, fileName: asset.fileName },
          userId, id,
        )
      } catch {
        Alert.alert('Photo', 'Could not add that photo. Please try again.')
      }
    }
    void refreshPhotos(id)
  }, [ensureEntry, userId, refreshPhotos])

  const removePhoto = useCallback(async (vm: PhotoVM) => {
    if (vm.legacy || !vm.photoId) return
    await deleteJournalPhoto(vm.photoId, vm.storagePath ?? null)
    void refreshPhotos(entryId)
  }, [entryId, refreshPhotos])

  const handleVoiceTranscript = useCallback((text: string) => {
    setBody((prev) => (prev ? `${prev} ${text}`.trim() : text))
    setInputMethod((m) => (m === 'keyboard' ? 'voice' : 'both'))
  }, [])

  const handleTextChange = useCallback((text: string) => {
    setBody(text)
    setInputMethod((m) => (m === 'voice' ? 'both' : 'keyboard'))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    // Photos are managed via journal_photos; photo_urls is left untouched
    // (preserved for legacy entries until backfilled).
    const { error } = await supabase
      .from('journal_entries')
      .upsert(
        { stamp_id: stampId, user_id: userId, body: body || null, mood_rating: mood, input_method: inputMethod, updated_at: new Date().toISOString() },
        { onConflict: 'stamp_id' },
      )
    setSaving(false)
    if (error) Alert.alert('Error', 'Could not save journal entry.')
    else onSaved()
  }, [stampId, userId, body, mood, inputMethod, onSaved])

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <MoodRating value={mood} onChange={setMood} />

      <TouchableOpacity onPress={() => setShowVoice((v) => !v)} style={styles.voiceToggle}>
        <Text style={styles.voiceToggleText}>{showVoice ? '⌨ Type instead' : '🎤 Use voice'}</Text>
      </TouchableOpacity>

      {showVoice && <VoiceRecorder onTranscriptUpdate={handleVoiceTranscript} />}

      <TextInput
        style={styles.textInput}
        multiline
        placeholder="Write about your experience…"
        placeholderTextColor="#bbb"
        value={body}
        onChangeText={handleTextChange}
        textAlignVertical="top"
      />

      {photos.length > 0 && (
        <ScrollView horizontal style={styles.photoStrip} showsHorizontalScrollIndicator={false}>
          {photos.map((p) => (
            <TouchableOpacity
              key={p.key}
              activeOpacity={0.9}
              onLongPress={() => removePhoto(p)}
              disabled={p.legacy}
            >
              <View style={styles.photoWrap}>
                {p.status === 'lost' ? (
                  <View style={[styles.photo, styles.photoMissing]}>
                    <Text style={styles.missingText}>photo{'\n'}unavailable</Text>
                  </View>
                ) : p.displayUri ? (
                  <Image source={{ uri: p.displayUri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoMissing]}>
                    <ActivityIndicator color={palette.accent} />
                  </View>
                )}

                {p.status === 'pending' && (
                  <View style={styles.badge}><Text style={styles.badgeText}>uploading…</Text></View>
                )}
                {p.status === 'failed' && (
                  <TouchableOpacity style={[styles.badge, styles.badgeFail]} onPress={() => p.photoId && retryFailedPhoto(p.photoId)}>
                    <Text style={styles.badgeText}>retry ↻</Text>
                  </TouchableOpacity>
                )}
                {p.legacy && (
                  <View style={[styles.badge, styles.badgeLegacy]}><Text style={styles.badgeText}>not backed up</Text></View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity onPress={addPhotos} style={styles.photoBtn}>
        <Text style={styles.photoBtnText}>+ Add photo</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save entry'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  voiceToggle: { alignSelf: 'flex-start', marginBottom: 8, padding: 6 },
  voiceToggleText: { fontSize: 13, color: palette.green, fontWeight: '600' },
  textInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 15,
    minHeight: 140, color: '#222', backgroundColor: '#fafafa', marginBottom: 12,
  },
  photoStrip: { flexDirection: 'row', marginBottom: 8 },
  photoWrap: { marginRight: 8 },
  photo: { width: 80, height: 80, borderRadius: 6, backgroundColor: '#eee' },
  photoMissing: { alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 10, color: '#999', textAlign: 'center' },
  badge: {
    position: 'absolute', bottom: 4, left: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingVertical: 2, alignItems: 'center',
  },
  badgeFail: { backgroundColor: 'rgba(155,35,53,0.85)' },
  badgeLegacy: { backgroundColor: 'rgba(201,168,76,0.9)' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  photoBtn: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  photoBtnText: { color: '#666', fontSize: 13 },
  saveBtn: { backgroundColor: palette.green, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
