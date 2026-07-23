// Offline-tolerant upload queue for journal photos.
//
// Resize happens at ENQUEUE time, so a single resized file is what we retry —
// image manipulation is never re-run per retry. The queue is AsyncStorage-backed
// so it survives app restarts. Uploads retry with exponential backoff and are
// triggered when the app foregrounds or the network returns online.
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'
import { AppState } from 'react-native'
import { supabase } from './supabase'
import { resizeJournalPhoto, uploadToStorage, buildStoragePath, type PickedImage } from './journal-photos'

const QUEUE_KEY = 'okuji.journalPhotoQueue.v1'
// 1s, 5s, 30s, 2m, 10m, then give up.
const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000]

export interface QueueItem {
  photoId: string
  journalEntryId: string
  userId: string
  localUri: string // resized file uri
  storagePath: string
  contentType: string
  queuedAt: number
  retryCount: number
  failed: boolean // true once retries are exhausted; skipped until a manual retry
}

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ── change notifier so the journal UI can refresh after uploads ──
type Listener = () => void
const listeners = new Set<Listener>()
export function addQueueListener(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
function notify() { listeners.forEach((l) => l()) }

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueueItem[]) : []
  } catch {
    return []
  }
}
async function writeQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

// Local URIs for every queued photo of an entry (pending or failed), keyed by
// photoId, so the UI can render the photo immediately while it uploads.
export async function getQueuedUrisForEntry(journalEntryId: string): Promise<Record<string, string>> {
  const q = await readQueue()
  const map: Record<string, string> = {}
  for (const it of q) if (it.journalEntryId === journalEntryId) map[it.photoId] = it.localUri
  return map
}

// Resize, create the pending DB row, and enqueue. Returns the new photo id and
// the resized local uri to display immediately.
export async function enqueueJournalPhoto(
  img: PickedImage,
  userId: string,
  journalEntryId: string,
): Promise<{ photoId: string; localUri: string }> {
  const resized = await resizeJournalPhoto(img)
  const photoId = uuidv4()
  const storagePath = buildStoragePath(userId, journalEntryId, photoId, resized.ext)

  const { error } = await supabase.from('journal_photos').insert({
    id: photoId,
    journal_entry_id: journalEntryId,
    user_id: userId,
    storage_path: storagePath,
    status: 'pending',
    original_filename: img.fileName ?? null,
    width_before: resized.widthBefore,
    height_before: resized.heightBefore,
    width_after: resized.width,
    height_after: resized.height,
  })
  if (error) throw error

  const q = await readQueue()
  q.push({
    photoId,
    journalEntryId,
    userId,
    localUri: resized.uri,
    storagePath,
    contentType: resized.contentType,
    queuedAt: Date.now(),
    retryCount: 0,
    failed: false,
  })
  await writeQueue(q)
  notify()
  void syncJournalPhotoQueue()
  return { photoId, localUri: resized.uri }
}

let syncing = false
export async function syncJournalPhotoQueue(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    const net = await Network.getNetworkStateAsync()
    if (!net.isConnected) {
      console.warn('[journal] photo upload deferred — device reports offline')
      return
    }

    const q = await readQueue()
    if (q.length === 0) return

    const next: QueueItem[] = []
    let scheduleIn: number | null = null

    for (const item of q) {
      if (item.failed) { next.push(item); continue } // wait for a manual retry
      try {
        const bytes = await uploadToStorage(item.localUri, item.storagePath, item.contentType)
        await supabase
          .from('journal_photos')
          .update({ status: 'uploaded', byte_size: bytes, updated_at: new Date().toISOString() })
          .eq('id', item.photoId)
        // Uploaded — drop from the queue. The resized local file is left for the
        // OS cache to reclaim.
      } catch (err) {
        // Was a silent catch — the #1 reason a photo never reaches the back
        // pages (which show status='uploaded' only) was invisible. Log the
        // real storage/DB error with a [journal] tag.
        console.error('[journal] photo upload failed', {
          photoId: item.photoId,
          storagePath: item.storagePath,
          retryCount: item.retryCount,
          error: err instanceof Error ? err.message : String(err),
        })
        if (item.retryCount + 1 >= BACKOFF_MS.length) {
          await supabase
            .from('journal_photos')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', item.photoId)
          next.push({ ...item, failed: true }) // keep localUri for manual retry
        } else {
          const retryCount = item.retryCount + 1
          next.push({ ...item, retryCount })
          const delay = BACKOFF_MS[retryCount]
          scheduleIn = scheduleIn == null ? delay : Math.min(scheduleIn, delay)
        }
      }
    }
    await writeQueue(next)
    notify()
    if (scheduleIn != null) setTimeout(() => { void syncJournalPhotoQueue() }, scheduleIn)
  } finally {
    syncing = false
  }
}

// Manual "retry upload" for a photo that exhausted its retries. Flips the row
// back to pending and re-queues with a fresh backoff. If the resized local file
// has since been evicted, the next upload attempt will simply fail again.
export async function retryFailedPhoto(photoId: string): Promise<void> {
  const q = await readQueue()
  const item = q.find((i) => i.photoId === photoId)
  if (!item) return
  item.failed = false
  item.retryCount = 0
  await writeQueue(q)
  await supabase.from('journal_photos').update({ status: 'pending' }).eq('id', photoId)
  notify()
  void syncJournalPhotoQueue()
}

let initialized = false
// Wire background triggers once, from the app root.
export function initJournalPhotoSync(): void {
  if (initialized) return
  initialized = true
  AppState.addEventListener('change', (s) => { if (s === 'active') void syncJournalPhotoQueue() })
  try {
    Network.addNetworkStateListener((state) => { if (state.isConnected) void syncJournalPhotoQueue() })
  } catch {
    // Older expo-network without addNetworkStateListener — the foreground
    // trigger still drives retries.
  }
  void syncJournalPhotoQueue()
}
