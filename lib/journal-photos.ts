// Journal photo storage helpers — resize, upload, signed URL, delete.
//
// PRIVACY (structural):
//   - Photos go to the PRIVATE `journal-photos` bucket under the user's own
//     folder: {user_id}/{journal_entry_id}/{photo_id}.{ext}. RLS enforces that
//     a user can only read/write under their own uid (see migration 005).
//   - Private bucket => display requires short-lived signed URLs.
//   - No EXIF stripping, no quality compression beyond the dimension cap.
//   - HEIC is NEVER transcoded: expo-image-manipulator cannot output HEIC, so
//     HEIC/HEIF files are uploaded as-is (the 5MB bucket cap is the backstop).
//     Only oversized JPEG/PNG are resized.
//   - We never log photo URIs or content.
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

export const BUCKET = 'journal-photos'
export const MAX_LONG_EDGE = 3000

export interface PickedImage {
  uri: string
  width?: number
  height?: number
  mimeType?: string
  fileName?: string | null
}

export interface ResizeResult {
  uri: string
  width: number | null
  height: number | null
  widthBefore: number | null
  heightBefore: number | null
  ext: string
  contentType: string
  resized: boolean
}

function extFromImage(img: PickedImage): string {
  const name = (img.fileName ?? img.uri).toLowerCase()
  const m = name.match(/\.(heic|heif|jpg|jpeg|png|webp)(\?|#|$)/)
  if (m) return m[1] === 'jpeg' ? 'jpg' : m[1]
  const t = (img.mimeType ?? '').toLowerCase()
  if (t.includes('heic')) return 'heic'
  if (t.includes('heif')) return 'heif'
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  return 'jpg'
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case 'heic': return 'image/heic'
    case 'heif': return 'image/heif'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    default: return 'image/jpeg'
  }
}

export function isHeic(ext: string): boolean {
  return ext === 'heic' || ext === 'heif'
}

// Resize only when needed. HEIC is preserved (never sent to the manipulator);
// non-HEIC images with a long edge <= MAX_LONG_EDGE are uploaded unchanged.
export async function resizeJournalPhoto(img: PickedImage): Promise<ResizeResult> {
  const ext = extFromImage(img)
  const widthBefore = img.width ?? null
  const heightBefore = img.height ?? null
  const longEdge = Math.max(img.width ?? 0, img.height ?? 0)

  if (isHeic(ext) || longEdge === 0 || longEdge <= MAX_LONG_EDGE) {
    return {
      uri: img.uri,
      width: img.width ?? null,
      height: img.height ?? null,
      widthBefore,
      heightBefore,
      ext,
      contentType: contentTypeForExt(ext),
      resized: false,
    }
  }

  const widthIsLong = (img.width ?? 0) >= (img.height ?? 0)
  const format = ext === 'png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG
  const outExt = ext === 'png' ? 'png' : 'jpg'
  // compress: 1 => no additional quality compression beyond the resize.
  const result = await ImageManipulator.manipulateAsync(
    img.uri,
    [{ resize: widthIsLong ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE } }],
    { compress: 1, format },
  )
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    widthBefore,
    heightBefore,
    ext: outExt,
    contentType: contentTypeForExt(outExt),
    resized: true,
  }
}

export function buildStoragePath(userId: string, journalEntryId: string, photoId: string, ext: string): string {
  return `${userId}/${journalEntryId}/${photoId}.${ext}`
}

// Uploads the (already-resized) local file. Returns the uploaded byte size.
export async function uploadToStorage(localUri: string, storagePath: string, contentType: string): Promise<number> {
  const arrayBuffer = await fetch(localUri).then((r) => r.arrayBuffer())
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, arrayBuffer, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return arrayBuffer.byteLength
}

// ── Signed-URL cache (private bucket needs signed URLs to display) ─────────────
const SIGNED_TTL_SECONDS = 3600
const signedCache = new Map<string, { url: string; expiresAt: number }>()

export async function getJournalPhotoUrl(storagePath: string): Promise<string | null> {
  const now = Date.now()
  const cached = signedCache.get(storagePath)
  if (cached && cached.expiresAt > now + 60_000) return cached.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  signedCache.set(storagePath, { url: data.signedUrl, expiresAt: now + SIGNED_TTL_SECONDS * 1000 })
  return data.signedUrl
}

export async function deleteJournalPhoto(photoId: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    signedCache.delete(storagePath)
  }
  await supabase.from('journal_photos').delete().eq('id', photoId)
}
