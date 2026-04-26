import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { lookupToken, isValidTokenFormat } from '../lib/qr'
import type { EmployeeAccount, RedemptionToken } from '../types'

export function useEmployeeAccount(userId: string) {
  const [account, setAccount] = useState<EmployeeAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('employee_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
      setAccount(data)
      setLoading(false)
    }
    if (userId) load()
  }, [userId])

  return { account, loading }
}

export function useTokenScanner() {
  const [scanning, setScanning] = useState(false)
  const [token, setToken] = useState<RedemptionToken | null>(null)
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

export function useRedemption() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordScan = useCallback(async (tokenId: string, employeeAccountId: string) => {
    const { error } = await supabase
      .from('redemption_tokens')
      .update({
        scanned_at: new Date().toISOString(),
        scanned_by_employee: employeeAccountId,
      })
      .eq('id', tokenId)
    return !error
  }, [])

  const recordDistribution = useCallback(async (params: {
    tokenId: string
    employeeAccountId: string
    prizeGiven: string
    isPending: boolean
    extraGiftCardCents?: number
    note?: string
  }) => {
    setSubmitting(true)
    setError(null)

    const { error } = await supabase
      .from('redemption_tokens')
      .update({
        prize_distributed_at: new Date().toISOString(),
        prize_given: params.prizeGiven,
        distributed_by: params.employeeAccountId,
        distribution_pending: params.isPending,
        extra_gift_card_cents: params.extraGiftCardCents ?? null,
        employee_note: params.note ?? null,
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
