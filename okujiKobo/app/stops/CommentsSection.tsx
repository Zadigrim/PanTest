'use client'

import { useEffect, useState } from 'react'

/**
 * Drawer Comments section.
 *
 * Lifecycle:
 *   - On mount (when the drawer focuses a stop) fetch GET
 *     /api/stops/<stopId>/comments. The server returns the
 *     list plus { viewerId, viewerIsAdmin } so per-row
 *     edit/delete affordances can be decided client-side
 *     without a second round-trip.
 *   - POST / PATCH / DELETE all re-fetch on success. Comments
 *     are infrequent + the list is tiny; an optimistic
 *     approach isn't worth the complexity.
 *
 * Writer-gating: when `canWrite` is false the compose box is
 * replaced by a quiet "Commenting is for institutional
 * educators" line — RLS would reject the POST regardless, but
 * the UI lead is a clearer signal.
 *
 * Used-this badge: comes from the server as `used_this`
 * (derived from stop_imports). Always-on display; not
 * user-toggleable.
 */

interface CommentRow {
  id: string
  stop_id: string
  author_id: string
  body: string
  created_at: string
  edited_at: string | null
  // Moderation state (KI-07, migration 068). hidden_at NULL → visible
  // to everyone; non-NULL → visible only to the author (marked-hidden
  // inline) and to platform admins (full body + unhide control).
  // reported_at NULL → not reported; non-NULL → an admin-only
  // "reported" indicator surfaces in the Stop Library.
  hidden_at: string | null
  reported_at: string | null
  author_name: string | null
  author_institution_name: string | null
  used_this: boolean
}

interface ApiResponse {
  viewerId: string
  viewerIsAdmin: boolean
  comments: CommentRow[]
}

const MAX_BODY_LEN = 1000

export function CommentsSection({
  stopId,
  canWrite,
}: {
  stopId: string
  canWrite: boolean
}) {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft]     = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stops/${stopId}/comments`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Could not load comments')
        return
      }
      const j = await res.json() as ApiResponse
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
    setDraft('')
    setEditingId(null)
    setEditDraft('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopId])

  async function handlePost() {
    const text = draft.trim()
    if (text.length === 0 || text.length > MAX_BODY_LEN) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch(`/api/stops/${stopId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Post failed')
        return
      }
      setDraft('')
      await refetch()
    } finally {
      setPosting(false)
    }
  }

  async function handleSaveEdit(commentId: string) {
    const text = editDraft.trim()
    if (text.length === 0 || text.length > MAX_BODY_LEN) return
    setError(null)
    const res = await fetch(`/api/stops/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Edit failed')
      return
    }
    setEditingId(null)
    setEditDraft('')
    await refetch()
  }

  async function handleDelete(commentId: string) {
    // No native confirm modal in the codebase yet — use the
    // browser confirm. Comments are rare + cheap; the cost of
    // a polished confirm UI exceeds its v1 value here.
    if (!window.confirm('Delete this comment?')) return
    setError(null)
    const res = await fetch(`/api/stops/comments/${commentId}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Delete failed')
      return
    }
    await refetch()
  }

  // KI-07 — any signed-in user can report. One report is enough;
  // repeats are no-ops on reported_at. Confirms first so the
  // report can't fire on accidental clicks.
  async function handleReport(commentId: string) {
    if (!window.confirm('Report this comment to moderators?')) return
    setError(null)
    const res = await fetch(`/api/stops/comments/${commentId}/report`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Report failed')
      return
    }
    await refetch()
  }

  // KI-07 — admin only. Server enforces via the SECURITY DEFINER
  // function; the UI gates the button on viewerIsAdmin so non-
  // admins never see it (defense in depth).
  async function handleToggleHidden(commentId: string, hidden: boolean) {
    const verb = hidden ? 'Hide' : 'Unhide'
    if (!window.confirm(`${verb} this comment?`)) return
    setError(null)
    const res = await fetch(`/api/stops/comments/${commentId}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? `${verb} failed`)
      return
    }
    await refetch()
  }

  const comments = data?.comments ?? []
  const viewerId = data?.viewerId ?? null
  const viewerIsAdmin = !!data?.viewerIsAdmin

  return (
    <section>
      <p className="mb-2 text-[9.5px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
        Comments{!loading && comments.length > 0 ? ` · ${comments.length}` : ''}
      </p>

      {error && (
        <p role="alert" className="mb-2 rounded-[6px] border border-red/40 bg-red/5 px-2 py-1.5 text-[11.5px] text-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[12px] text-muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-muted">No comments yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => {
            const canEdit   = !!viewerId && c.author_id === viewerId
            const canDelete = canEdit || viewerIsAdmin
            const isEditing = editingId === c.id
            const isHidden  = c.hidden_at != null
            const isAuthor  = !!viewerId && c.author_id === viewerId
            // Hidden + non-author + non-admin shouldn't reach here
            // (RLS filters), but render defensively. Author sees a
            // muted "hidden by moderators" treatment with body
            // collapsed; admin sees the full body + Unhide.
            return (
              <li
                key={c.id}
                className={
                  'rounded-[8px] border px-3 py-2.5 '
                  + (isHidden
                      ? 'border-clay/60 bg-clay/[0.04]'
                      : 'border-surface-faintdiv')
                }
              >
                {/* Header: author + institution + Used-this + date */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12px] font-semibold text-ink">
                    {c.author_name ?? 'Someone'}
                  </span>
                  {c.author_institution_name && (
                    <span className="text-[11px] text-muted">
                      · {c.author_institution_name}
                    </span>
                  )}
                  {c.used_this && <UsedThisChip />}
                  {/* Hidden chip — author sees it for their own
                      hidden comment; admin sees it for any. Non-
                      author / non-admin never reach a hidden row. */}
                  {isHidden && (
                    <span className="rounded-full bg-clay/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-clay" style={{ letterSpacing: '1px' }}>
                      Hidden
                    </span>
                  )}
                  {/* Reported indicator — ADMIN ONLY. Only renders
                      for reported-but-not-yet-hidden comments
                      (hidden comments already carry the Hidden
                      chip; the report chip would be visual noise). */}
                  {viewerIsAdmin && c.reported_at != null && !isHidden && (
                    <span
                      className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent"
                      style={{ letterSpacing: '1px' }}
                      title={`Reported ${relativeDate(c.reported_at)}`}
                    >
                      Reported
                    </span>
                  )}
                  <span className="ml-auto text-[10.5px] text-muted tabular-nums">
                    {relativeDate(c.created_at)}
                    {c.edited_at && <span className="italic"> · edited</span>}
                  </span>
                </div>

                {/* Body — author sees their own hidden body
                    collapsed; admin sees full hidden body for
                    moderation. */}
                {isEditing ? (
                  <div className="mt-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={MAX_BODY_LEN}
                      rows={3}
                      className="w-full resize-y rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-1.5 text-[12.5px] text-ink focus:border-ink focus:outline-none"
                    />
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditDraft('') }}
                        className="rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[11px] font-semibold text-ink hover:border-ink/40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(c.id)}
                        className="rounded-[6px] border-[1.5px] border-ink bg-green px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-green/90"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : isHidden && isAuthor && !viewerIsAdmin ? (
                  <p className="mt-1 text-[12px] italic text-muted">
                    This comment was hidden by moderators. Contact support to discuss.
                  </p>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-snug text-ink">
                    {c.body}
                  </p>
                )}

                {/* Per-row affordances */}
                {!isEditing && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px]">
                    {canEdit && !isHidden && (
                      <button
                        type="button"
                        onClick={() => { setEditingId(c.id); setEditDraft(c.body) }}
                        className="text-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id)}
                        className="text-muted underline-offset-2 hover:text-red hover:underline"
                      >
                        Delete
                      </button>
                    )}
                    {/* Report — any signed-in non-author can report.
                        Disabled-with-explanation after report fires;
                        never silently no-ops. */}
                    {!isAuthor && !viewerIsAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleReport(c.id)}
                        disabled={c.reported_at != null}
                        title={c.reported_at != null ? 'Already reported' : 'Report this comment to moderators'}
                        className="text-muted underline-offset-2 hover:text-clay hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {c.reported_at != null ? 'Reported' : 'Report'}
                      </button>
                    )}
                    {/* Hide / Unhide — admin only. Single button
                        whose label flips based on current state. */}
                    {viewerIsAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleToggleHidden(c.id, !isHidden)}
                        className="text-muted underline-offset-2 hover:text-clay hover:underline"
                      >
                        {isHidden ? 'Unhide' : 'Hide'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Compose / reader notice */}
      <div className="mt-3">
        {canWrite ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_BODY_LEN}
              rows={3}
              placeholder="Share how you used this stop, or what others should know…"
              className="w-full resize-y rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-1.5 text-[12.5px] text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10.5px] text-muted tabular-nums">
                {draft.length} / {MAX_BODY_LEN}
              </span>
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={posting || draft.trim().length === 0}
                className="rounded-[6px] border-[1.5px] border-ink bg-green px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-green/90 disabled:opacity-60"
              >
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11.5px] italic text-muted">
            Commenting is for institutional educators.
          </p>
        )}
      </div>
    </section>
  )
}

// ── Used-this badge ──
// Pure derivation from stop_imports (see GET handler). Owner of
// the chip is the server — the client just renders it.
function UsedThisChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-green bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[1px] text-green">
      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12l4 4L19 7" />
      </svg>
      Used this
    </span>
  )
}

// ── Relative date ──
// Small util — keeping it local rather than pulling in a
// formatter package for one display surface.
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const now  = Date.now()
  const diff = Math.max(0, now - then)
  const min  = 60 * 1000
  const hr   = 60 * min
  const day  = 24 * hr
  if (diff < min)        return 'just now'
  if (diff < hr)         return `${Math.floor(diff / min)}m ago`
  if (diff < day)        return `${Math.floor(diff / hr)}h ago`
  if (diff < 30 * day)   return `${Math.floor(diff / day)}d ago`
  if (diff < 365 * day)  return `${Math.floor(diff / (30 * day))}mo ago`
  return `${Math.floor(diff / (365 * day))}y ago`
}
