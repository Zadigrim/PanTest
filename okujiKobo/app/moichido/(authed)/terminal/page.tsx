import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TerminalClient, type TerminalCard } from '@/components/moichido/terminal/TerminalClient'

/**
 * /moichido/terminal — the in-venue merchant counter screen.
 *
 * Two halves, each capability-gated:
 *   - Issue a punch (can_verify): mint a one-off QR the customer
 *     scans to land a punch on their active card.
 *   - Redeem a card (can_distribute_prizes): redeem a completed
 *     card's completion code and distribute the prize.
 *
 * Both halves drive the existing M3 functions via server actions
 * (see ./actions.ts) — never /api/m3/*, which the M4.3 host-gate
 * makes unreachable from the moichido host.
 *
 * Merchant resolution mirrors the home/cards pages: the caller's
 * employee_authorizations row at an institution_type='moichido_merchant'.
 * No merchant access → /moichido/auth/denied. The capability flags on
 * that authorization row drive which halves render (and the M3
 * functions enforce them server-side regardless).
 *
 * Honest data: card list is a real query; no fabricated counts.
 */
export const metadata = { title: 'Terminal · moichido' }

export default async function TerminalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: authzRows } = await db
    .from('employee_authorizations')
    .select('institution_id, can_verify, can_distribute_prizes, institutions!inner(id, name, institution_type)')
    .eq('user_id', user.id)
    .eq('institutions.institution_type', 'moichido_merchant')

  const rows = (authzRows ?? []) as Array<{
    can_verify: boolean | null
    can_distribute_prizes: boolean | null
    institutions: { id: string; name: string }
  }>
  const row = rows[0]
  if (!row?.institutions) redirect('/moichido/auth/denied')

  const merchant = row.institutions
  const canVerify = row.can_verify === true
  const canDistribute = row.can_distribute_prizes === true

  // The merchant's punch cards — the issue half needs to know which
  // card a punch is for (consume resolves the passport from the
  // token's stop, so the punch must target the card the customer holds).
  const { data: cardRows } = await db
    .from('passports')
    .select('id, title, consumable_target_count')
    .eq('proprietor_id', merchant.id)
    .eq('credential_type', 'consumable')
    .order('created_at', { ascending: false })

  const cards: TerminalCard[] = ((cardRows ?? []) as Array<{
    id: string; title: string | null; consumable_target_count: number | null
  }>).map((c) => ({
    id: c.id,
    title: c.title || 'Untitled card',
    targetCount: c.consumable_target_count ?? 10,
  }))

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[3px] text-moichido-muted">
          {merchant.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-moichido-ink">Terminal</h1>
        <p className="mt-1 text-sm text-moichido-muted">
          Issue a punch for a customer to scan, or redeem a completed card.
        </p>
      </header>

      <TerminalClient
        cards={cards}
        canVerify={canVerify}
        canDistribute={canDistribute}
      />
    </div>
  )
}
