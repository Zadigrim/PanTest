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
    // Reload when the session settles. Fixes the post-login race where the
    // first load ran before auth was ready, so the RLS-scoped query returned
    // empty and the screen stuck on "No passports yet" until a manual refocus.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        load()
      }
    })
    return () => { mountedRef.current = false; subscription.unsubscribe() }
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

  useEffect(() => {
    load()
    // Same post-login race guard as useCollectorPassports: reload once the
    // session is available so the owned-overlay + browse list aren't empty.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        load()
      }
    })
    return () => subscription.unsubscribe()
  }, [load])

  return { passports, ownedIds, loading, reload: load }
}

export async function acquirePassport(
  passportId: string,
  userId: string,
  opts?: { demo?: boolean },
) {
  // Premium (paid) passports are NOT acquirable in the mobile app yet:
  // there is no in-app purchase rail (Google Play Billing is future
  // work), and granting a paid passport for free is wrong. Free
  // passports (price_cents 0 / null) acquire normally. Paid passports
  // are sold on the web (Stripe); a passport purchased there simply
  // appears in the holder's collection without coming through here.
  //
  // EXCEPTION — demo mode: opts.demo requests a demo acquisition.
  // Since migration 026 the payment gate lives in
  // ensure_collector_passport itself: a paid passport acquires only
  // when p_demo is true AND the caller passes is_demo_authorized()
  // server-side, and the row is marked acquired_demo. The price check
  // below is just a friendlier client-side error for ordinary users;
  // it is no longer what protects paid passports.
  if (!opts?.demo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (supabase as any)
      .from('passports').select('price_cents').eq('id', passportId).single()
    if (p && (p.price_cents ?? 0) > 0) {
      return { data: null, error: { message: 'premium_unavailable_in_app' } }
    }
  }

  // Routes through the SECURITY DEFINER ensure_collector_passport
  // function (mobile migration 019, payment/identity gate added in
  // 026) so the copy_number is allocated atomically and expires_at
  // is computed from the passport's expiry_duration_days in one
  // transaction. Idempotent: returns the existing row if already
  // acquired.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('ensure_collector_passport', {
    p_user_id: userId,
    p_passport_id: passportId,
    p_demo: opts?.demo ?? false,
  })
  // RPC returns a setof so data is an array; flatten to single.
  const row = Array.isArray(data) ? data[0] : data
  return { data: row, error }
}
