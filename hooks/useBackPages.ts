// Back-pages data — the collector's PRIVATE per-stop travel record appended
// to the end of a passport book.
//
// PRIVACY: every query here is scoped to the current user
//   - journal_entries / journal_photos: RLS is user_id = auth.uid()
//   - stop_reviews: filtered by author_id = the current user
// so a non-owner can never assemble another collector's back-pages (and the
// viewer only ever loads its own collection anyway). The review echo is the
// user's OWN review only, and is gated by the echoReviews preference.
//
// Baseline contract: EVERY stamped stop yields a record (name + verified_at),
// so the back-journal is a complete log; journal text, photos, and the
// review layer on where they exist.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getJournalPhotoUrl } from '../lib/journal-photos'
import type { Stop, Stamp } from '../types'

export interface BackPagePhoto {
  id: string
  uri: string
}

export interface BackPageRecord {
  stopId: string
  stop: Stop
  stamp: Stamp
  verifiedAt: string
  journalBody: string | null
  mood: number | null
  photos: BackPagePhoto[]
  review: { rating: number; body: string | null } | null
}

// Cap resolved photos per stop so a heavy entry doesn't fan out into dozens
// of signed-URL calls for a single back-page.
const MAX_PHOTOS_PER_STOP = 3

export function useBackPages({
  stopsByPage,
  stampsByPage,
  userId,
  echoReviews,
  enabled,
}: {
  stopsByPage: Record<string, Stop[]>
  stampsByPage: Record<string, Record<string, Stamp>>
  userId: string | null
  echoReviews: boolean
  enabled: boolean
}): { records: BackPageRecord[]; loading: boolean } {
  const [records, setRecords] = useState<BackPageRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Re-fetch key: the set of stamped stop ids + the echo toggle. Recomputed
  // from props so the effect re-runs when a new stamp lands.
  const stampIds = Object.values(stampsByPage)
    .flatMap((m) => Object.values(m))
    .map((s) => s.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!enabled || !userId) { setRecords([]); return }

    // Flatten stops + stamps into (stop, stamp) pairs for stamped stops only.
    const stopById: Record<string, Stop> = {}
    for (const list of Object.values(stopsByPage)) for (const s of list) stopById[s.id] = s
    const pairs: { stop: Stop; stamp: Stamp }[] = []
    for (const m of Object.values(stampsByPage)) {
      for (const stamp of Object.values(m)) {
        const stop = stopById[stamp.stop_id]
        if (stop) pairs.push({ stop, stamp })
      }
    }
    if (pairs.length === 0) { setRecords([]); return }

    let cancelled = false
    setLoading(true)
    void (async () => {
      const stopIds = pairs.map((p) => p.stop.id)
      const stIds = pairs.map((p) => p.stamp.id)

      // Journal entries for these stamps (RLS: own only).
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id, stamp_id, body, mood_rating')
        .in('stamp_id', stIds)
      const entryByStamp = new Map<string, { id: string; body: string | null; mood: number | null }>()
      for (const e of entries ?? []) {
        entryByStamp.set(e.stamp_id as string, { id: e.id as string, body: (e.body as string) ?? null, mood: (e.mood_rating as number) ?? null })
      }

      // Uploaded photos for those entries (skip pending/failed — back-pages
      // show what's durably stored).
      const entryIds = [...entryByStamp.values()].map((e) => e.id)
      const photosByEntry = new Map<string, BackPagePhoto[]>()
      if (entryIds.length > 0) {
        const { data: photoRows } = await supabase
          .from('journal_photos')
          .select('id, journal_entry_id, storage_path, status')
          .in('journal_entry_id', entryIds)
          .eq('status', 'uploaded')
          .order('created_at', { ascending: true })
        for (const row of photoRows ?? []) {
          const eid = row.journal_entry_id as string
          const list = photosByEntry.get(eid) ?? []
          if (list.length >= MAX_PHOTOS_PER_STOP || !row.storage_path) continue
          const uri = await getJournalPhotoUrl(row.storage_path as string)
          if (uri) { list.push({ id: row.id as string, uri }); photosByEntry.set(eid, list) }
        }
      }

      // The user's OWN reviews for these stops (echo only; never others').
      const reviewByStop = new Map<string, { rating: number; body: string | null }>()
      if (echoReviews) {
        const { data: reviews } = await supabase
          .from('stop_reviews')
          .select('stop_id, rating, body')
          .eq('author_id', userId)
          .in('stop_id', stopIds)
        for (const r of reviews ?? []) {
          reviewByStop.set(r.stop_id as string, { rating: r.rating as number, body: (r.body as string) ?? null })
        }
      }

      const built: BackPageRecord[] = pairs.map(({ stop, stamp }) => {
        const entry = entryByStamp.get(stamp.id)
        return {
          stopId: stop.id,
          stop,
          stamp,
          verifiedAt: stamp.verified_at,
          journalBody: entry?.body ?? null,
          mood: entry?.mood ?? null,
          photos: entry ? (photosByEntry.get(entry.id) ?? []) : [],
          review: reviewByStop.get(stop.id) ?? null,
        }
      })
      // Chronological travel log — earliest visit first.
      built.sort((a, b) => new Date(a.verifiedAt).getTime() - new Date(b.verifiedAt).getTime())

      if (!cancelled) { setRecords(built); setLoading(false) }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, echoReviews, stampIds])

  return { records, loading }
}
