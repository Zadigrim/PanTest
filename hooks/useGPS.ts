// GPS hook — reads location only at the moment of stamp verification.
// Never requests background location access.
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentLocation, type LocationReading } from '../lib/gps'

export type GPSState = 'idle' | 'checking' | 'verified' | 'failed' | 'denied'

export function useGPS() {
  const [state, setState] = useState<GPSState>('idle')
  const [location, setLocation] = useState<LocationReading | null>(null)

  const checkLocation = useCallback(async () => {
    setState('checking')
    const loc = await getCurrentLocation()
    if (!loc) {
      setState('denied')
      return null
    }
    setLocation(loc)
    setState('verified')
    return loc
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setLocation(null)
  }, [])

  return { state, location, checkLocation, reset }
}

export function useStampVerification() {
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{
    verified: boolean
    geohash?: string
    verificationMethod?: string
    reason?: string
  } | null>(null)

  const verify = useCallback(async (params: {
    stopId: string
    latitude: number
    longitude: number
    qrCodeId?: string
    stopOpenedAt: string
  }) => {
    setVerifying(true)
    setResult(null)

    const { data, error } = await supabase.functions.invoke('verify-stamp', {
      body: params,
    })

    setVerifying(false)

    if (error || !data) {
      // Surface auth failures coherently rather than a generic error.
      const status = (error as { context?: { status?: number } } | null)?.context?.status
      const reason =
        status === 401 ? 'Please sign in again to stamp.'
        : status === 403 ? "You don't have access to this passport."
        : 'Verification failed'
      setResult({ verified: false, reason })
      return null
    }

    setResult(data)
    return data as { verified: boolean; geohash: string; verificationMethod: string; reason?: string }
  }, [])

  const reset = useCallback(() => setResult(null), [])

  return { verifying, result, verify, reset }
}
