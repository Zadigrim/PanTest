import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

/**
 * POST /api/notify/comp-grant
 *
 * Sends the recipient a "your access has been upgraded" email after
 * an admin grants them a Pro / Studio comp subscription. Fire-and-
 * forget from the client: both grant entry points
 * (UserCompPanel, /access/comp-subscriptions) call this AFTER the
 * comp_subscriptions row is in. If this route fails the grant is
 * still in place — the email is informational, not transactional —
 * and the client surfaces a soft warning instead of rolling back.
 *
 * Authorization mirrors the existing admin proxy routes
 * (/api/admin/users/[id]/email, /api/employees/lookup):
 *   1. The user-context client auth-checks the caller.
 *   2. is_platform_admin RPC gates the action — same bar as the
 *      comp_subscriptions INSERT RLS that just succeeded.
 *   3. Only then do we touch the service-role admin client to read
 *      the RECIPIENT's email from auth.users (PostgREST can't reach
 *      auth.users; profiles doesn't carry the email).
 *
 * Body:
 *   { userId: string, tier: 'pro' | 'studio',
 *     expiresAt?: string | null, note?: string | null }
 *
 * Returns 200 { sent: true } on success. Errors are logged + returned
 * with the appropriate status; the caller treats any non-200 as
 * "grant succeeded, email didn't" and surfaces a soft warning.
 */

const TIER_LABEL: Record<'pro' | 'studio', string> = {
  pro:    'Pro',
  studio: 'Studio',
}

// Short description for the email body. Kept in sync with the
// marketing copy on the upgrade page; if those names change, update
// here so the email doesn't drift.
const TIER_BLURB: Record<'pro' | 'studio', string> = {
  pro:    'Pro unlocks the full holder experience — unlimited passports, journals, and the priority verification queue.',
  studio: 'Studio unlocks the full creator toolkit — publish to the marketplace, custom stamp design, premium fonts, and unlimited pages.',
}

function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function POST(request: NextRequest) {
  // ── 1. Auth-check the caller ─────────────────────────────────────
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // ── 2. Validate body ─────────────────────────────────────────────
  const body = await request.json().catch(() => ({})) as {
    userId?: string
    tier?: 'pro' | 'studio'
    expiresAt?: string | null
    note?: string | null
  }
  const userId = body.userId
  const tier   = body.tier
  if (!userId || (tier !== 'pro' && tier !== 'studio')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // ── 3. Look up the recipient's email + display name ─────────────
  // auth.users lives outside PostgREST → need the admin client.
  // profiles is reachable but doesn't carry the email column.
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authUser, error: authErr } = await (admin.auth as any).admin.getUserById(userId)
  if (authErr || !authUser?.user?.email) {
    return NextResponse.json({ error: 'Recipient has no email on file' }, { status: 404 })
  }
  const recipientEmail = authUser.user.email as string

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  const recipientName = profile?.display_name ?? 'there'

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', caller.id)
    .single()
  const callerName = callerProfile?.display_name ?? 'The Okuji team'

  // ── 4. Compose + send ────────────────────────────────────────────
  const tierLabel = TIER_LABEL[tier]
  const expiresLine = body.expiresAt
    ? `<p style="color:#64748B;font-size:13px;">Your ${tierLabel} access runs through <strong>${new Date(body.expiresAt).toLocaleDateString()}</strong>.</p>`
    : `<p style="color:#64748B;font-size:13px;">Your ${tierLabel} access doesn’t expire.</p>`
  const noteLine = body.note?.trim()
    ? `<p style="color:#64748B;font-size:13px;margin-top:8px;border-left:3px solid #1D9E75;padding-left:10px;"><em>“${escapeHtml(body.note.trim())}”</em></p>`
    : ''

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const { error: sendErr } = await resend.emails.send({
    from: 'Okuji <no-reply@okuji.app>',
    to: recipientEmail,
    subject: `You’ve been upgraded to ${tierLabel} on Okuji`,
    html: `
      <div style="font-family:serif;max-width:480px;margin:0 auto;padding:32px;">
        <h1 style="color:#0D1B2A;font-size:22px;margin:0 0 12px;">Welcome to ${tierLabel}, ${escapeHtml(recipientName)}.</h1>
        <p style="color:#64748B;font-size:14px;margin:0 0 16px;">
          ${escapeHtml(callerName)} just gifted you a <strong>${tierLabel}</strong> subscription on Okuji.
        </p>
        <div style="background:#E1F5EE;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#0F6E56;">${TIER_BLURB[tier]}</p>
        </div>
        ${expiresLine}
        ${noteLine}
        <p style="color:#64748B;font-size:13px;margin-top:24px;">
          Open Okuji to start using your new access:
          <br />
          <a href="https://okuji.app/" style="color:#1D9E75;font-weight:600;text-decoration:none;">okuji.app</a>
        </p>
        <p style="margin-top:32px;color:#94A3B8;font-size:12px;">Okuji · Real experiences, collected.</p>
      </div>
    `,
  })

  if (sendErr) {
    console.error('comp-grant email send failed:', sendErr)
    return NextResponse.json({ error: 'Email failed' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
