import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, AppState,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { MoodRating } from './MoodRating'
import { VoiceRecorder } from './VoiceRecorder'
import type { InputMethod, JournalPhoto } from '../../types'
import { palette } from '../../lib/colors'
import { getJournalPhotoUrl, deleteJournalPhoto } from '../../lib/journal-photos'
import { EmptyJournal } from '../ui/Illustrations'
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
  // Save state machine drives the persistent indicator (no more silent
  // loss): idle → saving → saved, or → error (recoverable via Retry).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showVoice, setShowVoice] = useState(false)
  const [entryId, setEntryId] = useState<string | null>(existingEntryId)
  const [photos, setPhotos] = useState<PhotoVM[]>([])

  // Latest content in refs so the unmount / background flush persists what's
  // on screen RIGHT NOW without stale-closure capture, and so autosave can
  // compare against the last-saved snapshot to avoid redundant writes.
  const contentRef = useRef({ body, mood, inputMethod })
  contentRef.current = { body, mood, inputMethod }
  const lastSavedRef = useRef<string>(JSON.stringify({ body: existingBody, mood: existingMood }))
  const dirtyRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Single write path for the entry's text/mood. Upserts on stamp_id (one
  // row per stamp — migration 027's UNIQUE(stamp_id)), so it's safe to call
  // repeatedly: autosave, manual save, the photo pipeline, and flush-on-exit
  // all funnel through here. Reads the latest content from the ref so a
  // flush during unmount persists exactly what's on screen. Returns the row
  // id (needed to attach photos) or null on failure.
  const persist = useCallback(async (): Promise<string | null> => {
    const { body: b, mood: m, inputMethod: im } = contentRef.current
    setSaveState('saving')
    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(
        { stamp_id: stampId, user_id: userId, body: b || null, mood_rating: m, input_method: im, updated_at: new Date().toISOString() },
        { onConflict: 'stamp_id' },
      )
      .select('id')
      .single()
    if (error || !data) {
      setSaveState('error')
      return null
    }
    setEntryId(data.id)
    lastSavedRef.current = JSON.stringify({ body: b, mood: m })
    dirtyRef.current = false
    setSaveState('saved')
    return data.id
  }, [stampId, userId])

  // Photo pipeline needs a row id; reuse the existing row or persist to make
  // one.
  const ensureEntry = useCallback(async (): Promise<string | null> => {
    if (entryId) return entryId
    const id = await persist()
    if (!id) Alert.alert('Error', 'Could not start the journal entry. Please try again.')
    return id
  }, [entryId, persist])

  // Mark unsaved on any user edit (also flips the indicator off "Saved").
  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setSaveState((s) => (s === 'saving' ? s : 'idle'))
  }, [])

  // Debounced autosave — persist ~1s after the last edit, only when content
  // actually changed. This removes the "typed, then tapped Done without
  // Save" silent-loss path.
  useEffect(() => {
    if (!dirtyRef.current) return
    if (JSON.stringify({ body, mood }) === lastSavedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void persist() }, 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [body, mood, inputMethod, persist])

  // Flush on background and on unmount (sheet dismissed via Done / back /
  // swipe / the review link) so nothing on screen is ever lost without an
  // explicit Save tap.
  useEffect(() => {
    const flush = () => {
      const snap = JSON.stringify({ body: contentRef.current.body, mood: contentRef.current.mood })
      if (snap !== lastSavedRef.current) void persist()
    }
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') flush() })
    return () => { sub.remove(); flush() }
  }, [persist])

  // Both addFromLibrary and addFromCamera route through the SAME
  // enqueueJournalPhoto pipeline so persistence / retry / delete behavior
  // is identical. The single difference is the source of the asset URI.
  const enqueueAssets = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return
    const id = await ensureEntry()
    if (!id) return

    for (const asset of assets) {
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

  const addFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      // expo-image-picker 17 (SDK 54) removed MediaTypeOptions; the current
      // API is an array of media-type strings. Using the old enum threw
      // "Cannot read property 'Images' of undefined", crashing the picker.
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      // No quality reduction here — resizing/upload is handled by the queue.
    })
    if (result.canceled) return
    await enqueueAssets(result.assets)
  }, [enqueueAssets])

  const addFromCamera = useCallback(async () => {
    // launchCameraAsync uses the OS camera (same package as the library
    // picker), not the expo-camera CameraView used by the employee/scan
    // flows. Chosen for surface-area parity with addFromLibrary — both
    // return the same asset shape so they share enqueueAssets / the
    // upload queue / the photo-strip UI without a custom camera screen.
    const perms = await ImagePicker.requestCameraPermissionsAsync()
    if (!perms.granted) {
      Alert.alert(
        'Camera permission needed',
        'Allow camera access to take a photo, or choose an existing photo from your library.',
      )
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], // see addFromLibrary — MediaTypeOptions removed in v17
      // No quality reduction here — resizing/upload is handled by the queue.
    })
    if (result.canceled) return
    await enqueueAssets(result.assets)
  }, [enqueueAssets])

  const removePhoto = useCallback(async (vm: PhotoVM) => {
    if (vm.legacy || !vm.photoId) return
    await deleteJournalPhoto(vm.photoId, vm.storagePath ?? null)
    void refreshPhotos(entryId)
  }, [entryId, refreshPhotos])

  const handleVoiceTranscript = useCallback((text: string) => {
    setBody((prev) => (prev ? `${prev} ${text}`.trim() : text))
    setInputMethod((m) => (m === 'keyboard' ? 'voice' : 'both'))
    markDirty()
  }, [markDirty])

  const handleTextChange = useCallback((text: string) => {
    setBody(text)
    setInputMethod((m) => (m === 'voice' ? 'both' : 'keyboard'))
    markDirty()
  }, [markDirty])

  const handleMoodChange = useCallback((m: number | null) => {
    setMood(m)
    markDirty()
  }, [markDirty])

  // Manual "Save & close": flush now, dismiss on success, keep the sheet
  // open with the error indicator if it failed (so the user can retry).
  const save = useCallback(async () => {
    const id = await persist()
    if (id) onSaved()
    else Alert.alert('Couldn’t save', 'Your entry isn’t saved yet — check your connection and tap Retry.')
  }, [persist, onSaved])

  // A pristine entry (nothing written, no mood, no photos) shows the
  // branded journal illustration as a gentle prompt; it falls away the
  // moment the collector starts filling it in.
  const isPristine = !body && mood == null && photos.length === 0

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {isPristine && (
        <View style={styles.emptyHero}>
          <EmptyJournal width={180} />
          <Text style={styles.emptyHeroText}>Capture this stop in your own words.</Text>
        </View>
      )}

      <MoodRating value={mood} onChange={handleMoodChange} />

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

      <View style={styles.photoBtnRow}>
        <TouchableOpacity onPress={addFromCamera} style={styles.photoBtn}>
          <Text style={styles.photoBtnText}>📷 Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={addFromLibrary} style={styles.photoBtn}>
          <Text style={styles.photoBtnText}>🖼 Choose existing</Text>
        </TouchableOpacity>
      </View>

      {/* Persistent save-state line — the entry autosaves, so this is the
          honest confirmation that it's stored (or a recoverable error). */}
      <View style={styles.saveStatusRow}>
        {saveState === 'saving' && <ActivityIndicator size="small" color={palette.muted} />}
        <Text style={[styles.saveStatusText, saveState === 'error' && styles.saveStatusError]}>
          {saveState === 'saving' ? 'Saving…'
            : saveState === 'saved' ? 'Saved'
            : saveState === 'error' ? 'Not saved — tap Retry'
            : 'Autosaves as you write'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={saveState === 'error' ? () => void persist() : save}
        style={styles.saveBtn}
        disabled={saveState === 'saving'}
      >
        <Text style={styles.saveBtnText}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry save' : 'Save & close'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  emptyHero: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 8 },
  emptyHeroText: { fontSize: 13, color: palette.muted, textAlign: 'center' },
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
  photoBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  photoBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center' },
  photoBtnText: { color: '#666', fontSize: 13 },
  saveStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  saveStatusText: { fontSize: 12, color: palette.muted },
  saveStatusError: { color: palette.red },
  saveBtn: { backgroundColor: palette.green, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
