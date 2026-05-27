// One-time, on-demand backfill of legacy local-URI journal photos into storage.
//
// NOT auto-run — must be triggered explicitly by the user. Never deletes journal
// entries. For each photo URI still present on the device it resizes (non-HEIC)
// and uploads; URIs whose file is gone are recorded as a 'lost' photo row so the
// user can see what happened.
import { File } from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'
import { resizeJournalPhoto, uploadToStorage, buildStoragePath, isHeic, type PickedImage } from './journal-photos'
import { uuidv4 } from './journal-photo-queue'

export interface BackfillProgress {
  processed: number
  uploaded: number
  lost: number
  failed: number
}

function extFromUri(uri: string): string {
  const m = uri.toLowerCase().match(/\.(heic|heif|jpg|jpeg|png|webp)(\?|#|$)/)
  if (!m) return 'jpg'
  return m[1] === 'jpeg' ? 'jpg' : m[1]
}

export async function backfillJournalPhotos(
  userId: string,
  onProgress?: (p: BackfillProgress) => void,
): Promise<BackfillProgress> {
  const p: BackfillProgress = { processed: 0, uploaded: 0, lost: 0, failed: 0 }

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, photo_urls')
    .eq('user_id', userId)
  if (error || !entries) return p

  for (const entry of entries as { id: string; photo_urls: string[] | null }[]) {
    const uris = entry.photo_urls ?? []
    if (uris.length === 0) continue

    for (const uri of uris) {
      p.processed++

      let exists = false
      try {
        exists = new File(uri).exists
      } catch {
        exists = false
      }

      if (!exists) {
        await supabase.from('journal_photos').insert({
          id: uuidv4(),
          journal_entry_id: entry.id,
          user_id: userId,
          storage_path: null,
          status: 'lost',
          original_filename: uri.split('/').pop() ?? null,
        })
        p.lost++
        onProgress?.({ ...p })
        continue
      }

      try {
        const ext = extFromUri(uri)
        const img: PickedImage = { uri }
        // Probe dimensions for non-HEIC so resizeJournalPhoto can decide whether
        // to downscale. HEIC is never probed (would force a transcode) — it
        // uploads as-is.
        if (!isHeic(ext)) {
          try {
            const probe = await ImageManipulator.manipulateAsync(uri, [], {})
            img.width = probe.width
            img.height = probe.height
          } catch {
            // dimensions unknown — resizeJournalPhoto will upload as-is
          }
        } else {
          img.mimeType = `image/${ext}`
        }

        const resized = await resizeJournalPhoto(img)
        const photoId = uuidv4()
        const path = buildStoragePath(userId, entry.id, photoId, resized.ext)
        const bytes = await uploadToStorage(resized.uri, path, resized.contentType)
        await supabase.from('journal_photos').insert({
          id: photoId,
          journal_entry_id: entry.id,
          user_id: userId,
          storage_path: path,
          status: 'uploaded',
          byte_size: bytes,
          original_filename: uri.split('/').pop() ?? null,
          width_before: resized.widthBefore,
          height_before: resized.heightBefore,
          width_after: resized.width,
          height_after: resized.height,
        })
        p.uploaded++
      } catch {
        p.failed++
      }
      onProgress?.({ ...p })
    }

    // Clear the now-migrated local URIs; the entry itself is preserved.
    await supabase.from('journal_entries').update({ photo_urls: [] }).eq('id', entry.id)
  }

  return p
}
