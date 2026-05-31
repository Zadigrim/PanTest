import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { lookupToken, isValidTokenFormat } from '../lib/qr'
import type { CompletionToken, EmployeeAuthorization } from '../types'

// Resolves the caller's employee_authorizations row at the institution
// they're acting at, joined with institution metadata for venue display.
//
// Terminal gate: requires can_distribute_prizes = true. The canonical
// completion_tokens RLS (tokens_employee_update in
// okujiKobo/supabase/migrations/012_blockpoint4.sql:394-405) requires
// this flag for any UPDATE — including the redeemed_at / redeemed_by
// write that the scan step performs. A user with only can_verify = true
// would pass an opener-level gate but every subsequent UPDATE would
// silently fail, leaving the user stuck mid-flow. can_distribute_prizes
// is the honest gate.
//
// Multi-institution behavior matches contexts/EmployeeContext.tsx:
// .maybeSingle() with no ordering. The proper switcher is FIX-03 /
// BLD-30 work; this PR intentionally inherits the same arbitrary-pick
// behavior so it doesn't diverge.
export function useEmployeeAuth(userId: string) {
  const [auth, setAuth] = useState<EmployeeAuthorization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!userId) { setLoading(false); return }
      const { data } = await supabase
        .from('employee_authorizations')
        .select(`
          id, user_id, institution_id, can_verify, can_distribute_prizes,
          institutions ( name, institution_type, catalog_url )
        `)
        .eq('user_id', userId)
        .eq('can_distribute_prizes', true)
        .maybeSingle()

      if (!data) {
        setAuth(null)
      } else {
        const inst = (data as any).institutions
        setAuth({
          id: data.id,
          user_id: data.user_id,
          institution_id: data.institution_id,
          can_verify: data.can_verify,
          can_distribute_prizes: data.can_distribute_prizes,
          institution_name: inst?.name ?? undefined,
          institution_type: inst?.institution_type ?? undefined,
          catalog_url: inst?.catalog_url ?? null,
        })
      }
      setLoading(false)
    }
    load()
  }, [userId])

  return { auth, loading }
}

export function useTokenScanner() {
  const [scanning, setScanning] = useState(false)
  const [token, setToken] = useState<CompletionToken | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scanToken = useCallback(async (code: string) => {
    setScanning(true)
    setError(null)
    setToken(null)

    if (!isValidTokenFormat(code)) {
      setError('Invalid token format. Expected MCM-XXXX-XX.')
      setScanning(false)
      return null
    }

    const data = await lookupToken(code)

    if (!data) {
      setError('Token not found or already redeemed.')
      setScanning(false)
      return null
    }

    if (new Date(data.expires_at) < new Date()) {
      setError('Token has expired.')
      setScanning(false)
      return null
    }

    setToken(data)
    setScanning(false)
    return data
  }, [])

  const reset = useCallback(() => {
    setToken(null)
    setError(null)
  }, [])

  return { scanning, token, error, scanToken, reset }
}

// Both recordScan and recordDistribution write to completion_tokens
// (the canonical table) with the actor stored as employeeUserId — a
// profiles.id (auth.uid()), not a row-ID in any employee table. This
// matches the canonical schema's redeemed_by / distribution_logged_by
// FK targets and survives the retirement of employee_accounts.
export function useRedemption() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordScan = useCallback(async (tokenId: string, employeeUserId: string) => {
    const { error } = await supabase
      .from('completion_tokens')
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by: employeeUserId,
      })
      .eq('id', tokenId)
    return !error
  }, [])

  const recordDistribution = useCallback(async (params: {
    tokenId: string
    employeeUserId: string
    prizeGiven: string
    isPending: boolean
    extraGiftCardCents?: number
    note?: string
  }) => {
    setSubmitting(true)
    setError(null)

    const { error } = await supabase
      .from('completion_tokens')
      .update({
        distribution_logged_at: new Date().toISOString(),
        distribution_logged_by: params.employeeUserId,
        prize_distributed: !params.isPending,
        distribution_pending: params.isPending,
        prize_given: params.prizeGiven,
        extra_gift_card_cents: params.extraGiftCardCents ?? null,
        prize_note: params.note ?? null,
      })
      .eq('id', params.tokenId)

    setSubmitting(false)
    if (error) { setError(error.message); return false }
    return true
  }, [])

  const verifyExperienceStamp = useCallback(async (params: {
    stampId: string
    employeeUserId: string
    note?: string
  }) => {
    const { error } = await supabase
      .from('stamps')
      .update({
        verification_method: 'employee',
        verifier_id: params.employeeUserId,
        verifier_note: params.note ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', params.stampId)
    return !error
  }, [])

  return { submitting, error, recordScan, recordDistribution, verifyExperienceStamp }
}
