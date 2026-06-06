'use server'

import { revalidatePath } from 'next/cache'

/**
 * Server action invoked by the designer's persist layer when a stop
 * save touches location-relevant fields (lat, lng, address_street,
 * address_city) OR when the full saveAll completes. Invalidates the
 * caches that surface the location-audit count:
 *
 *   /              — operator dashboard's HeroAlert + AttentionQueue
 *                    "audit-summary" row (lib/dashboard/load.ts).
 *   /dashboard/audit — the detailed "Stops needing location data"
 *                    list (app/dashboard/audit/page.tsx).
 *
 * Why this matters: both pages use `cookies()` so they're dynamic,
 * but Next 14's client-side Router Cache prefetches links on hover.
 * After a designer save fixes a missing address, the next click
 * back to the audit page could serve the stale prefetched payload
 * showing the issue still present. revalidatePath invalidates the
 * client Router Cache for the matching paths so the next visit
 * fetches fresh server data.
 *
 * Fire-and-forget from the client — the persist layer doesn't wait
 * on this, and a transient failure here just means the next page
 * load reads stale data for one render (it'll catch up on the
 * round after that). Idempotent + cheap; safe to call on every
 * successful stops write.
 */
export async function revalidateLocationAudit(): Promise<void> {
  revalidatePath('/dashboard/audit')
  revalidatePath('/')
}
