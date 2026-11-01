// Passport collections — collector-side read hooks (migration 111).
import { useState, useEffect, useCallback } from 'react'
import { supabase, getCurrentUser } from '../lib/supabase'
import type { Passport, PassportCollection, CollectionReward } from '../types'

export type MemberStatus = 'not_started' | 'in_progress' | 'completed'

export interface CollectionMemberView {
  passport: Passport
  status: MemberStatus
}
export interface CollectionRewardView extends CollectionReward {
  earned: boolean
}
export interface CollectionView {
  collection: PassportCollection
  members: CollectionMemberView[]   // PUBLISHED members only
  rewards: CollectionRewardView[]
  done: number
  total: number
}

function pickOne<T>(embed: T | T[] | null | undefined): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? (embed[0] ?? null) : embed
}

export function useCollection(collectionId: string | undefined) {
  const [data, setData] = useState<CollectionView | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!collectionId) { setData(null); setLoading(false); return }
    setLoading(true)
    const user = await getCurrentUser()

    const { data: col } = await supabase
      .from('passport_collections').select('*').eq('id', collectionId).maybeSingle()
    if (!col) { setData(null); setLoading(false); return }

    const { data: itemRows } = await supabase
      .from('passport_collection_items')
      .select('position, passport:passports(*)')
      .eq('collection_id', collectionId)
      .order('position', { ascending: true })
    // Published members only — draft members are owner-only / excluded.
    const members: Passport[] = (itemRows ?? [])
      .map((r: { passport: Passport | Passport[] | null }) => pickOne(r.passport))
      .filter((p): p is Passport => !!p && p.is_published)

    const { data: rewardRows } = await supabase
      .from('passport_collection_rewards').select('*').eq('collection_id', collectionId)
      .order('created_at', { ascending: true })

    const completed = new Set<string>()
    const owned = new Set<string>()
    const earnedKeys = new Set<string>()
    if (user) {
      const { data: cps } = await supabase
        .from('collector_passports').select('passport_id, completed_at').eq('user_id', user.id)
      for (const cp of cps ?? []) {
        owned.add(cp.passport_id as string)
        if (cp.completed_at) completed.add(cp.passport_id as string)
      }
      const { data: badges } = await supabase
        .from('collector_badges').select('badge_key').eq('user_id', user.id)
      for (const b of badges ?? []) earnedKeys.add(b.badge_key as string)
    }

    const memberViews: CollectionMemberView[] = members.map((p) => ({
      passport: p,
      status: completed.has(p.id) ? 'completed' : owned.has(p.id) ? 'in_progress' : 'not_started',
    }))
    const rewardViews: CollectionRewardView[] = (rewardRows ?? []).map((r: CollectionReward) => ({
      ...r, earned: earnedKeys.has(r.badge_key),
    }))

    setData({
      collection: col as PassportCollection,
      members: memberViews,
      rewards: rewardViews,
      done: memberViews.filter((m) => m.status === 'completed').length,
      total: memberViews.length,
    })
    setLoading(false)
  }, [collectionId])

  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

// Published collections for the Discovery shelf.
export function usePublishedCollections() {
  const [collections, setCollections] = useState<PassportCollection[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('passport_collections').select('*').eq('status', 'published')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setCollections((data ?? []) as PassportCollection[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])
  return { collections, loading }
}

// Collections a given passport belongs to (published only) — for the detail
// "Part of:" chips.
export function usePassportCollections(passportId: string | undefined) {
  const [collections, setCollections] = useState<PassportCollection[]>([])
  useEffect(() => {
    if (!passportId) return
    let cancelled = false
    supabase
      .from('passport_collection_items')
      .select('collection:passport_collections(*)')
      .eq('passport_id', passportId)
      .then(({ data }) => {
        if (cancelled) return
        const list = (data ?? [])
          .map((r: { collection: PassportCollection | PassportCollection[] | null }) => pickOne(r.collection))
          .filter((c): c is PassportCollection => !!c && c.status === 'published')
        setCollections(list)
      })
    return () => { cancelled = true }
  }, [passportId])
  return collections
}
