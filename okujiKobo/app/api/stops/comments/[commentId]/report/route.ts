import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stops/comments/:commentId/report
 *
 * Any signed-in user can report a comment. Sets reported_at to
 * now() iff currently null; repeat reports are no-ops on the
 * timestamp. No counting, no queue, no review surface — one
 * report is enough to surface the comment to admins via the
 * reported-but-not-hidden indicator (KI-07 spec).
 *
 * Body: none.
 * Response: { reported_at }.
 *
 * Implementation routes through the SECURITY DEFINER
 * report_stop_comment(uuid) RPC (migration 068) so the
 * column-specific write semantics are concentrated in PL/pgSQL.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('report_stop_comment', {
    p_comment_id: commentId,
  })
  if (error) {
    const isNotFound = (error as { code?: string }).code === 'no_data_found'
    return NextResponse.json(
      { error: error.message ?? 'Report failed' },
      { status: isNotFound ? 404 : 500 },
    )
  }
  return NextResponse.json({ ok: true, reported_at: data })
}
