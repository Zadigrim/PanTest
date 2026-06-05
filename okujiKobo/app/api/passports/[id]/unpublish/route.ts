import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/passports/:id/unpublish
 *
 * Reverses publish: sets is_published=false and status='draft'
 * on a passport the caller owns. Holders KEEP access — they
 * read via the new `passports_acquired_read` / `pages_acquired_read`
 * / `stops_acquired_read` policies (migration 062). The
 * Explore + free-PDF + new-acquisition routes already gate
 * on is_published=true, so a single column flip delists the
 * passport everywhere that should delist.
 *
 * No side effects beyond the row update:
 *   * Snapshots (passport_published_snapshots) stay — they're
 *     the diff target for the next republish.
 *   * cover_image_url / page_image_urls stay — holders still
 *     see them in their library; the next republish refreshes.
 *   * acquisitions / collector_passports stay (obviously).
 *   * stamps / journals stay (always).
 *
 * No body. Response: { ok, holderCount } so the UI can echo
 * the count back to the designer.
 *
 * Permission: passport creator OR platform admin (mirrors
 * the passports_creator RLS). The route checks ownership
 * explicitly so a denied unpublish returns 403 rather than
 * an RLS no-op.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, is_published')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }
  if (passport.creator_id !== user.id) {
    const { data: prof } = await db
      .from('profiles').select('is_platform_admin').eq('id', user.id).single()
    if (!prof?.is_platform_admin) {
      return NextResponse.json({ error: 'Not the creator' }, { status: 403 })
    }
  }
  if (!passport.is_published) {
    return NextResponse.json({ error: 'Passport is already a draft' }, { status: 409 })
  }

  // Holder count for the confirm-dialog echo.
  const [{ count: acqCount }, { count: cpCount }] = await Promise.all([
    db.from('acquisitions')
      .select('id', { count: 'exact', head: true })
      .eq('passport_id', passportId),
    db.from('collector_passports')
      .select('id', { count: 'exact', head: true })
      .eq('passport_id', passportId),
  ])
  const holderCount = Math.max(acqCount ?? 0, cpCount ?? 0)

  const { error: updErr } = await db
    .from('passports')
    .update({ is_published: false, status: 'draft' })
    .eq('id', passportId)
  if (updErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (updErr as any).message ?? 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, holderCount })
}
