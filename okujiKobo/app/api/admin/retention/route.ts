import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Passport retention control surface (migration 085). Thin wrapper over the
 * SECURITY DEFINER functions, which hard-enforce the admin gate and the
 * preservation invariant — this route adds friendly auth + shaping.
 *
 * GET  /api/admin/retention?idleDays=180
 *   DRY-RUN report. Returns the never-published, idle, zero-lifetime-holder
 *   drafts that WOULD be eligible. Changes NOTHING. Run this against real
 *   data to verify the detection logic before any state is touched.
 *
 * POST /api/admin/retention   body: { action, passportId, recoveryDays? }
 *   action ∈ 'flag' | 'keep' | 'soft_delete' | 'purge' | 'force_purge'
 *   - flag        active/→ grace (30-day creator warning)   [admin]
 *   - keep        any → active (creator one-click reclaim)   [creator or admin]
 *   - soft_delete grace → soft_deleted (recoverable)         [admin]
 *   - purge       soft_deleted → hard delete                 [admin, gated]
 *   - force_purge ANY passport → cascade hard delete         [admin, gated]
 *       Overrides the preservation invariant: deletes the passport AND its
 *       full acquisition/engagement tree regardless of holders. No recovery
 *       window, no soft-delete prerequisite. For owner test-data cleanup and
 *       genuine remediation. Atomic + fail-closed (migration 094).
 * Each transition re-checks eligibility and is logged. Purge / force_purge are
 * the destructive actions and never run unattended — one explicit call per
 * passport. No bulk/sweep endpoint by design.
 */

function statusFor(code?: string): number {
  return code === 'insufficient_privilege' ? 403
       : code === 'no_data_found'          ? 404
       : code === 'check_violation'        ? 409
       : 500
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Admin-only: the report lists other creators' draft titles, so gate it
  // (the destructive RPCs self-gate; the read needs gating here).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Platform admin required' }, { status: 403 })
  }
  const idleDays = Number(request.nextUrl.searchParams.get('idleDays') ?? 180)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('retention_scan_drafts', {
    p_idle_days: Number.isFinite(idleDays) ? idleDays : 180,
  })
  if (error) {
    return NextResponse.json({ error: error.message ?? 'Scan failed' }, { status: statusFor((error as { code?: string }).code) })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]) ?? []
  return NextResponse.json({ dryRun: true, idleDays, eligibleCount: rows.length, eligible: rows })
}

const RPC: Record<string, string> = {
  flag:        'retention_flag',
  keep:        'retention_keep',
  soft_delete: 'retention_soft_delete',
  purge:       'retention_purge',
  force_purge: 'force_purge_passport',
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const action = body?.action as string | undefined
  const passportId = body?.passportId as string | undefined
  if (!action || !RPC[action] || !passportId) {
    return NextResponse.json(
      { error: "action ('flag'|'keep'|'soft_delete'|'purge'|'force_purge') and passportId are required" },
      { status: 400 },
    )
  }

  const args: Record<string, unknown> = { p_passport_id: passportId }
  if (action === 'purge' && typeof body?.recoveryDays === 'number') {
    args.p_recovery_days = body.recoveryDays
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(RPC[action], args)
  if (error) {
    return NextResponse.json({ error: error.message ?? 'Transition failed' }, { status: statusFor((error as { code?: string }).code) })
  }
  return NextResponse.json({ ok: true, action, result: data ?? null })
}
