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
    const { data: stopsData } = await supabase
      .from('stops')
      .select('*')
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
  const { data, error } = await supabase
    .from('collector_passports')
    .insert({ user_id: userId, passport_id: passportId })
    .select()
    .single()
  return { data, error }
}
