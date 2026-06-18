'use server'

// Platform-admin merchant-management actions (moichido surface).
//
// These run server-side (a server action is a DB call, not an HTTP request
// through middleware) so the /api host-gate doesn't apply — same reason the
// terminal uses server actions. Every action self-gates on is_platform_admin;
// the UI gating in the layout is convenience, this is the real gate.
//
// No live billing. moichido_recorded_amount_cents is a managed value. Suspend
// is state (institutions.status), never a destructive delete of history.

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/lib/supabase/types'
import type { ActionResult } from './types'

function serviceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

// Returns the admin's user id, or an error. THE gate for every mutation here.
async function requireAdmin(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { db: any; userId: string } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) return { error: 'Platform admin required.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: supabase as any, userId: user.id }
}

const DETAIL = (id: string) => `/moichido/merchants/${id}`
const LIST = '/moichido/merchants'

// ── Add a merchant: institution + owner authorization ────────────────────────
export async function createMerchant(input: {
  name: string
  ownerEmail: string
  canVerify: boolean
  canDistributePrizes: boolean
}): Promise<ActionResult & { id?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const name = input.name?.trim()
  const email = input.ownerEmail?.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Merchant name is required.' }
  if (!email) return { ok: false, error: 'Owner email is required.' }

  // Resolve the owner's existing okuji account by email (service role).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lookup, error: lookupErr } = await (serviceClient().auth as any)
    .admin.getUserByEmail(email)
  if (lookupErr || !lookup?.user) {
    return { ok: false, error: `No okuji account found for ${email}. The owner must sign up first.` }
  }
  const ownerId = lookup.user.id as string

  const { data: inst, error: instErr } = await gate.db
    .from('institutions')
    .insert({
      name,
      institution_type: 'moichido_merchant',
      status: 'active',
    })
    .select('id')
    .single()
  if (instErr || !inst) {
    return { ok: false, error: instErr?.message ?? 'Could not create the merchant.' }
  }

  const { error: authzErr } = await gate.db
    .from('employee_authorizations')
    .insert({
      institution_id: inst.id,
      user_id: ownerId,
      role_label: 'Owner',
      can_verify: input.canVerify,
      can_distribute_prizes: input.canDistributePrizes,
      authorized_by: gate.userId,
    })
  if (authzErr) {
    return { ok: false, error: `Merchant created but linking the owner failed: ${authzErr.message}` }
  }

  revalidatePath(LIST)
  return { ok: true, id: inst.id }
}

// ── Manage access: capability flags for an existing authorization ────────────
export async function setCapabilities(input: {
  institutionId: string
  userId: string
  canVerify: boolean
  canDistributePrizes: boolean
}): Promise<ActionResult> {
  const gate = await requireAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const { error } = await gate.db
    .from('employee_authorizations')
    .update({ can_verify: input.canVerify, can_distribute_prizes: input.canDistributePrizes })
    .eq('institution_id', input.institutionId)
    .eq('user_id', input.userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(DETAIL(input.institutionId))
  return { ok: true }
}

// ── Suspend / reactivate (state, never destructive) ──────────────────────────
export async function setMerchantStatus(input: {
  institutionId: string
  status: 'active' | 'suspended'
}): Promise<ActionResult> {
  const gate = await requireAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }
  if (input.status !== 'active' && input.status !== 'suspended') {
    return { ok: false, error: 'Invalid status.' }
  }

  const { error } = await gate.db
    .from('institutions')
    .update({ status: input.status })
    .eq('id', input.institutionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(DETAIL(input.institutionId))
  revalidatePath(LIST)
  return { ok: true }
}

// ── Subscription: tier, card limit, recorded amount (no live billing) ────────
export async function setSubscription(input: {
  institutionId: string
  tier: string | null
  cardLimit: number | null
  recordedAmountCents: number | null
}): Promise<ActionResult> {
  const gate = await requireAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const cardLimit =
    input.cardLimit != null && Number.isFinite(input.cardLimit) && input.cardLimit >= 0
      ? Math.floor(input.cardLimit)
      : null
  const amount =
    input.recordedAmountCents != null && Number.isFinite(input.recordedAmountCents) && input.recordedAmountCents >= 0
      ? Math.floor(input.recordedAmountCents)
      : null

  const { error } = await gate.db
    .from('institutions')
    .update({
      moichido_tier: input.tier?.trim() || null,
      moichido_card_limit: cardLimit,
      moichido_recorded_amount_cents: amount,
    })
    .eq('id', input.institutionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(DETAIL(input.institutionId))
  revalidatePath(LIST)
  return { ok: true }
}

// ── Comp status via comp_subscriptions (the one comp mechanism) ──────────────
// Institution-scoped row (tier='moichido', user_id NULL); the 036 trigger
// ignores it. comped=true ensures one active row; comped=false revokes it.
export async function setComp(input: {
  institutionId: string
  comped: boolean
  note?: string
  expiresAt?: string | null
}): Promise<ActionResult> {
  const gate = await requireAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const { data: active } = await gate.db
    .from('comp_subscriptions')
    .select('id')
    .eq('institution_id', input.institutionId)
    .is('revoked_at', null)
    .maybeSingle()

  if (input.comped) {
    if (active) {
      const { error } = await gate.db
        .from('comp_subscriptions')
        .update({ note: input.note?.trim() || null, expires_at: input.expiresAt || null })
        .eq('id', active.id)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await gate.db
        .from('comp_subscriptions')
        .insert({
          institution_id: input.institutionId,
          tier: 'moichido',
          granted_by: gate.userId,
          note: input.note?.trim() || null,
          expires_at: input.expiresAt || null,
        })
      if (error) return { ok: false, error: error.message }
    }
  } else if (active) {
    const { error } = await gate.db
      .from('comp_subscriptions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', active.id)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(DETAIL(input.institutionId))
  revalidatePath(LIST)
  return { ok: true }
}
