import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getCurrentUser } from '../lib/supabase'
import type { Passport, PassportPage, Stop, CollectorPassport } from '../types'

export function usePassport(passportId: string) {
  const [passport, setPassport] = useState<Passport | null>(null)
  const [pages, setPages] = useState<PassportPage[]>([])
  const [stops, setStops] = useState<Record<string, Stop[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: passportData, error: passportError } = await supabase
      .from('passports')
      .select('*')
      .eq('id', passportId)
      .single()

    if (passportError) {
      setError(passportError.message)
      setLoading(false)
      return
    }

    const { data: pagesData } = await supabase
      .from('passport_pages')
      .select('*')
      .eq('passport_id', passportId)
      .order('page_order')

    const pageIds = (pagesData ?? []).map((p) => p.id)
    // Join the design_assets row for any stop that has a custom-asset
    // stamp, so the renderer can pull the actual artwork URL without a
    // second fetch per stop. Stops with stamp_type='emoji' get
    // stamp_asset = null and fall back to the icon-and-shape path.
    const { data: stopsData } = await supabase
      .from('stops')
      .select('*, stamp_asset:design_assets!stamp_asset_id(url)')
      .in('page_id', pageIds)
      .order('stop_order')

    const stopsByPage: Record<string, Stop[]> = {}
    for (const stop of stopsData ?? []) {
      if (!stopsByPage[stop.page_id]) stopsByPage[stop.page_id] = []
      stopsByPage[stop.page_id].push(stop)
    }

    setPassport(passportData)
    setPages(pagesData ?? [])
    setStops(stopsByPage)
    setLoading(false)
  }, [passportId])

  useEffect(() => { load() }, [load])

  return { passport, pages, stops, loading, error, reload: load }
}

export function useCollectorPassports() {
  const [passports, setPassports] = useState<(CollectorPassport & { passport: Passport })[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    const user = await getCurrentUser()
    if (!user) {
      if (mountedRef.current) { setPassports([]); setLoading(false) }
      return
    }
    const { data } = await supabase
      .from('collector_passports')
      .select('*, passport:passports(*)')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('acquired_at', { ascending: false })

    if (mountedRef.current) {
      setPassports((data as any) ?? [])
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  return { passports, loading, reload: load }
}

export function usePublishedPassports() {
  const [passports, setPassports] = useState<Passport[]>([])
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const user = await getCurrentUser()

    const [publishedResult, ownedResult] = await Promise.all([
      supabase
        .from('passports')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      user
        ? supabase
            .from('collector_passports')
            .select('passport_id')
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    setPassports(publishedResult.data ?? [])
    setOwnedIds(new Set((ownedResult.data ?? []).map((r: any) => r.passport_id)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { passports, ownedIds, loading, reload: load }
}

export async function acquirePassport(passportId: string, userId: string) {
  // Premium (paid) passports are NOT acquirable in the mobile app yet:
  // there is no in-app purchase rail (Google Play Billing is future
  // work), and granting a paid passport for free is wrong. Free
  // passports (price_cents 0 / null) acquire normally. Paid passports
  // are sold on the web (Stripe); a passport purchased there simply
  // appears in the holder's collection without coming through here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (supabase as any)
    .from('passports').select('price_cents').eq('id', passportId).single()
  if (p && (p.price_cents ?? 0) > 0) {
    return { data: null, error: { message: 'premium_unavailable_in_app' } }
  }

  // Routes through the SECURITY DEFINER ensure_collector_passport
  // function (mobile migration 019) so the copy_number is
  // allocated atomically and expires_at is computed from the
  // passport's expiry_duration_days in one transaction.
  // Idempotent: returns the existing row if already acquired.
  const { data, error } = await (supabase as any).rpc('ensure_collector_passport', {
    p_user_id: userId,
    p_passport_id: passportId,
  })
  // RPC returns a setof so data is an array; flatten to single.
  const row = Array.isArray(data) ? data[0] : data
  return { data: row, error }
}
