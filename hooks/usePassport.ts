import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('collector_passports')
        .select('*, passport:passports(*)')
        .order('acquired_at', { ascending: false })

      setPassports((data as any) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return { passports, loading }
}

export function usePublishedPassports() {
  const [passports, setPassports] = useState<Passport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('passports')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      setPassports(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return { passports, loading }
}

export async function acquirePassport(passportId: string, userId: string) {
  const { data, error } = await supabase
    .from('collector_passports')
    .insert({ user_id: userId, passport_id: passportId })
    .select()
    .single()
  return { data, error }
}
