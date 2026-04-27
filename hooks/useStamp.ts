import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { saveStamp } from '../lib/stamp'
import type { Stamp, Stop, StampPlacement, StampSlotState } from '../types'

export function useStampState(stopId: string, userId: string) {
  const [slotState, setSlotState] = useState<StampSlotState>('dormant')
  const [stamp, setStamp] = useState<Stamp | null>(null)
  const [loading, setLoading] = useState(false)

  const checkExistingStamp = useCallback(async () => {
    const { data } = await supabase
      .from('stamps')
      .select('*')
      .eq('stop_id', stopId)
      .eq('user_id', userId)
      .single()

    if (data) {
      setStamp(data)
      setSlotState('stamped')
    }
  }, [stopId, userId])

  const markReady = useCallback(() => {
    setSlotState((prev) => (prev === 'dormant' ? 'ready' : prev))
  }, [])

  const startPress = useCallback(() => {
    setSlotState((prev) => (prev === 'ready' ? 'pressing' : prev))
  }, [])

  const cancelPress = useCallback(() => {
    setSlotState((prev) => (prev === 'pressing' ? 'ready' : prev))
  }, [])

  const completeStamp = useCallback(
    async (params: {
      collectorPassportId: string
      geohash: string
      placement: StampPlacement
      verificationMethod: string
      stopOpenedAt: string
    }) => {
      setLoading(true)
      const { data, error } = await saveStamp({
        userId,
        stopId,
        ...params,
      })

      if (!error && data) {
        setStamp(data)
        setSlotState('stamped')
      } else {
        setSlotState('ready')
      }
      setLoading(false)
      return { data, error }
    },
    [userId, stopId]
  )

  return { slotState, stamp, loading, checkExistingStamp, markReady, startPress, cancelPress, completeStamp }
}

export function usePageStamps(pageId: string, userId: string) {
  const [stamps, setStamps] = useState<Record<string, Stamp>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: stops } = await supabase
      .from('stops')
      .select('id')
      .eq('page_id', pageId)

    if (!stops?.length) { setLoading(false); return }

    const { data } = await supabase
      .from('stamps')
      .select('*')
      .eq('user_id', userId)
      .in('stop_id', stops.map((s) => s.id))

    const byStop: Record<string, Stamp> = {}
    for (const s of data ?? []) byStop[s.stop_id] = s
    setStamps(byStop)
    setLoading(false)
  }, [pageId, userId])

  useEffect(() => { load() }, [load])

  return { stamps, loading, reload: load }
}
