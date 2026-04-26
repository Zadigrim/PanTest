// QR code generation and validation utilities.
import { supabase } from './supabase'

export function generateQrPayload(stopId: string, qrCodeId: string): string {
  return JSON.stringify({ stopId, qrCodeId, v: 1 })
}

export function parseQrPayload(raw: string): { stopId: string; qrCodeId: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.stopId && parsed.qrCodeId) {
      return { stopId: parsed.stopId, qrCodeId: parsed.qrCodeId }
    }
    return null
  } catch {
    return null
  }
}

export function isValidTokenFormat(code: string): boolean {
  return /^MCM-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(code)
}

export async function lookupToken(tokenCode: string) {
  if (!isValidTokenFormat(tokenCode)) return null

  const { data, error } = await supabase
    .from('redemption_tokens')
    .select(`
      *,
      passport_pages (
        section_name,
        prize_description,
        passport_id,
        passports (title)
      )
    `)
    .eq('token_code', tokenCode)
    .single()

  if (error) return null
  return data
}
