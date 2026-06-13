// Data layer for public stop reviews (migration 084).
//
// Reviews are a SEPARATE, outward-facing record from the private journal.
// Every gate (adult attestation, verified-visitor, youth-institution
// disable) is enforced server-side inside submit_stop_review; the helpers
// here drive the UI (what to show / disable) and surface clear errors when
// the server refuses. Nothing here is the security boundary — the SECURITY
// DEFINER functions are.
import { supabase } from './supabase'
import type { StopReview, StopReviewSummary } from '../types'

// Columns the public display + author-edit surfaces need. We never select
// hidden_by (admin-only bookkeeping) — RLS already filters hidden rows for
// non-admins, and the admin hide control doesn't need to know who hid it.
const REVIEW_COLUMNS =
  'id, stop_id, author_id, rating, body, attribution, hidden_at, reported_at, created_at, edited_at'

// Has the current user completed the one-time 18+ attestation?
export async function hasAttestedAdult(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('adult_attested_at')
    .eq('id', data.user.id)
    .single()
  return Boolean(profile?.adult_attested_at)
}

// Record the one-time 18+ attestation. Idempotent (server COALESCEs).
export async function attestAdult(): Promise<void> {
  const { error } = await supabase.rpc('attest_adult')
  if (error) throw error
}

// Is the public review surface enabled for this stop? FALSE when the stop's
// operating institution is a youth/education type (hard-disable).
export async function reviewsEnabledForStop(stopId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('stop_reviews_enabled', { p_stop_id: stopId })
  if (error) return false // fail closed on error — no review surface
  return data === true
}

// Is the current user a verified visitor of this stop (earned the stamp)?
// Self-reported stamps count. Reads the caller's own stamps (RLS-scoped).
export async function isVerifiedVisitor(stopId: string): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false
  const { data: stamp } = await supabase
    .from('stamps')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('stop_id', stopId)
    .limit(1)
    .maybeSingle()
  return Boolean(stamp)
}

// The current user's own review of a stop, if any (so the composer can
// pre-fill for editing). Returns null when none exists.
export async function getMyReview(stopId: string): Promise<StopReview | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const { data: review } = await supabase
    .from('stop_reviews')
    .select(REVIEW_COLUMNS)
    .eq('stop_id', stopId)
    .eq('author_id', data.user.id)
    .maybeSingle()
  return (review as StopReview) ?? null
}

// Public reviews for a stop. RLS returns non-hidden rows (plus the viewer's
// own, plus everything for platform admins). Newest first.
export async function listStopReviews(stopId: string): Promise<StopReview[]> {
  const { data, error } = await supabase
    .from('stop_reviews')
    .select(REVIEW_COLUMNS)
    .eq('stop_id', stopId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as StopReview[]) ?? []
}

// Authoritative per-stop aggregate (excludes hidden rows).
export async function getStopReviewSummary(stopId: string): Promise<StopReviewSummary> {
  const { data, error } = await supabase.rpc('stop_review_summary', { p_stop_id: stopId })
  if (error) throw error
  // The RPC returns a one-row table.
  const row = Array.isArray(data) ? data[0] : data
  return {
    avg_rating: row?.avg_rating != null ? Number(row.avg_rating) : null,
    review_count: row?.review_count != null ? Number(row.review_count) : 0,
  }
}

// Create or edit the caller's review. The server re-checks every gate and
// snapshots attribution; editing preserves any moderation state. Returns the
// review id.
export async function submitStopReview(
  stopId: string,
  rating: number,
  body: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('submit_stop_review', {
    p_stop_id: stopId,
    p_rating: rating,
    p_body: body && body.trim() ? body.trim() : null,
  })
  if (error) throw error
  return data as string
}

// Remove the caller's own review (author delete). Admin removal is a hide,
// not a delete — see setReviewHidden.
export async function deleteMyReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('stop_reviews').delete().eq('id', reviewId)
  if (error) throw error
}

// Report a review for moderation (any signed-in user). One report is enough;
// repeated reports are no-ops server-side.
export async function reportStopReview(reviewId: string): Promise<void> {
  const { error } = await supabase.rpc('report_stop_review', { p_review_id: reviewId })
  if (error) throw error
}

// Platform-admin hide / unhide (KI-07 reuse). The function re-checks
// is_platform_admin; a non-admin call throws.
export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_stop_review_hidden', {
    p_review_id: reviewId,
    p_hidden: hidden,
  })
  if (error) throw error
}

// Is the current user a platform admin? Drives the inline hide/unhide
// control on the review list. The authoritative gate is the SECURITY DEFINER
// function; this only decides whether to render the control.
export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin')
  if (error) return false
  return data === true
}
