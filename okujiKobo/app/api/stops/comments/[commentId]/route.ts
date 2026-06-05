import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH  /api/stops/comments/:commentId  body: { body: string }
 *   Edits the comment body. RLS limits this to author_id = auth.uid().
 *   The route stamps edited_at = now() (the policy doesn't enforce
 *   it because we want a future admin-side rewrite path to be able
 *   to clean a comment without lying about edit time).
 *
 * DELETE /api/stops/comments/:commentId
 *   Removes the comment. RLS allows author OR platform admin —
 *   the route is a thin pass-through.
 *
 * Stop ID is recoverable from the comment row; we don't take it
 * as a path segment because that would invite client / server
 * disagreement about ownership.
 */

const MAX_BODY_LEN = 1000

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (text.length === 0) return NextResponse.json({ error: 'Comment body required' }, { status: 400 })
  if (text.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `Comment exceeds ${MAX_BODY_LEN} characters` }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('stop_comments')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('id')
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (error as any).message ?? 'Update failed' }, { status: 500 })
  }
  // RLS made the row invisible / non-updatable: 0 rows back.
  // Surface as 403 so the client can show "you can't edit
  // this comment" rather than a silent no-op.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Not allowed to edit this comment' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('stop_comments')
    .delete()
    .eq('id', commentId)
    .select('id')
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (error as any).message ?? 'Delete failed' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Not allowed to delete this comment' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
