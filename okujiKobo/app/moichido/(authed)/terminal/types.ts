// Shared result shapes for the terminal server actions. Kept out of
// actions.ts because a 'use server' module may only export async
// functions — types live here so both the actions and the client UI
// can import them.

export interface IssueResult {
  ok: boolean
  error?: string
  token?: string
  qrDataUrl?: string
  expiresAtMs?: number
}

export interface RedeemResult {
  ok: boolean
  error?: string
}
