/**
 * Pure publish-checklist validation — single source of truth for
 * "can this passport publish?" Lives outside the React component so
 * the post-login dashboard can run the same checks on drafts to
 * surface near-publish ones without instantiating the editor store.
 *
 * The editor's PublishFlow imports from here; do not fork this logic
 * inside the component.
 *
 * Migration-046 model:
 *   experience_type = 'experience'                → location-less by
 *     design (e.g. reading-program book); NEVER blocked for missing
 *     coords / address.
 *   experience_type = 'location' + method='gps'   → coords required.
 *   experience_type = 'location' + method='qr'    → address required.
 *   experience_type = 'location' + 'witnessed' /
 *     'documented'                                → optional, never
 *     blocked.
 *
 * Pre-046 rows that never got the canonical pair backfilled fall
 * back to verification_tier (mirrors deriveExpType/deriveMethod in
 * RightInspector — the panel and this validator agree on the model).
 */

import type { OkujiKoboRole } from '@/lib/roles'

// Minimal slices so this validator can run against either editor-store
// objects (DesignerPassport / DesignerStop) or raw DB rows. We pick
// only the fields the checklist needs.

export interface PublishStop {
  experience_type: 'location' | 'experience' | null | undefined
  experience_verification_method:
    | 'gps' | 'qr' | 'witnessed' | 'documented' | 'presence' | 'honor'
    | null | undefined
  verification_tier: number | null
  lat: number | null
  lng: number | null
  address_street: string | null
  address_city: string | null
}

export interface PublishPassport {
  title: string
  proprietor_id: string | null
  expected_spend_tier: string | null | undefined
}

export interface PublishCheckInput {
  passport: PublishPassport
  pageCount: number
  stops: PublishStop[]
  /** Has the actor an active Studio subscription? Personal passports
   *  (proprietor_id IS NULL) require Studio to publish to the
   *  marketplace; institutional passports skip this gate. Pass null
   *  to skip the check (e.g. when the dashboard hasn't fetched
   *  subscription state). */
  actorIsStudio?: boolean | null
}

export type StopLocationIssue = 'coords' | 'address' | null

export function stopLocationIssue(stop: PublishStop): StopLocationIssue {
  const expType =
    stop.experience_type === 'experience' ? 'experience'
    : stop.experience_type === 'location' ? 'location'
    : stop.verification_tier === 5 ? 'experience'
    : 'location'
  if (expType === 'experience') return null

  const m = stop.experience_verification_method
  const method =
    m === 'gps' || m === 'qr' || m === 'witnessed' || m === 'documented' ? m
    : stop.verification_tier === 3 ? 'gps'
    : stop.verification_tier === 1 || stop.verification_tier === 2 ? 'qr'
    : stop.verification_tier === 4 ? 'witnessed'
    : 'gps'

  if (method === 'gps') {
    // typeof check so lat=0 / lng=0 (equator, prime meridian) counts as set.
    const hasCoords = typeof stop.lat === 'number' && typeof stop.lng === 'number'
    return hasCoords ? null : 'coords'
  }
  if (method === 'qr') {
    const hasAddress = !!(stop.address_street?.trim() || stop.address_city?.trim())
    return hasAddress ? null : 'address'
  }
  // witnessed / documented — location optional, never blocks.
  return null
}

export interface PublishCheckResult {
  blockers: string[]
  detail: {
    missingTitle: boolean
    noPages: boolean
    gpsMissingCoords: number
    qrMissingAddress: number
    noSpendTier: boolean
    needsStudio: boolean
  }
  canPublish: boolean
}

export function runPublishChecklist({
  passport,
  pageCount,
  stops,
  actorIsStudio = null,
}: PublishCheckInput): PublishCheckResult {
  const blockers: string[] = []

  const missingTitle = !passport.title.trim() || passport.title === 'Untitled Passport'
  if (missingTitle) blockers.push('Give your passport a real title.')

  const noPages = pageCount === 0
  if (noPages) blockers.push('Add at least one page.')

  const gpsMissingCoords = stops.filter((s) => stopLocationIssue(s) === 'coords').length
  const qrMissingAddress = stops.filter((s) => stopLocationIssue(s) === 'address').length
  if (gpsMissingCoords > 0) {
    blockers.push(`${gpsMissingCoords} GPS stop(s) need coordinates. Open the stop and use the map picker.`)
  }
  if (qrMissingAddress > 0) {
    blockers.push(`${qrMissingAddress} QR stop(s) need an address.`)
  }

  const noSpendTier = !passport.expected_spend_tier
  if (noSpendTier) blockers.push('Set an expected spend tier (Settings → Expected Spend).')

  // Studio gate: only for personal passports, only when we know the
  // actor's state. Institutional passports are gated by RLS + a server
  // trigger; the dashboard doesn't need to mirror that.
  const needsStudio =
    passport.proprietor_id === null && actorIsStudio === false
  if (needsStudio) {
    blockers.push(
      'Publishing a personal passport to the marketplace requires Studio. Ask an admin for a Studio comp at /access/comp-subscriptions.',
    )
  }

  return {
    blockers,
    detail: {
      missingTitle,
      noPages,
      gpsMissingCoords,
      qrMissingAddress,
      noSpendTier,
      needsStudio,
    },
    canPublish: blockers.length === 0,
  }
}

// Re-exported so existing imports in PublishFlow that pulled
// stopLocationIssue keep working without referencing the role layer.
export type { OkujiKoboRole }
