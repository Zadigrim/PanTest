import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface MerchantRow {
  id: string
  name: string
  status: string | null
  moichido_tier: string | null
  moichido_card_limit: number | null
  moichido_recorded_amount_cents: number | null
}

export const dynamic = 'force-dynamic'

export default async function MerchantsListPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data } = await db
    .from('institutions')
    .select('id, name, status, moichido_tier, moichido_card_limit, moichido_recorded_amount_cents, created_at')
    .eq('institution_type', 'moichido_merchant')
    .order('created_at', { ascending: false })
  const merchants = (data ?? []) as MerchantRow[]
  const ids = merchants.map((m) => m.id)

  // Real counts — card count (consumable passports) + active comp, batched.
  const cardCounts: Record<string, number> = {}
  const compActive: Record<string, boolean> = {}
  if (ids.length > 0) {
    const { data: cards } = await db
      .from('passports')
      .select('proprietor_id')
      .eq('credential_type', 'consumable')
      .in('proprietor_id', ids)
    for (const c of (cards ?? []) as { proprietor_id: string }[]) {
      cardCounts[c.proprietor_id] = (cardCounts[c.proprietor_id] ?? 0) + 1
    }
    const { data: comps } = await db
      .from('comp_subscriptions')
      .select('institution_id')
      .in('institution_id', ids)
      .is('revoked_at', null)
    for (const c of (comps ?? []) as { institution_id: string }[]) {
      compActive[c.institution_id] = true
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-moichido-ink">Merchants</h1>
          <p className="mt-1 text-sm text-moichido-muted">
            {merchants.length} merchant{merchants.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/moichido/merchants/new"
          className="rounded-[8px] bg-moichido-teal px-4 py-2 text-sm font-semibold text-moichido-paper hover:opacity-90"
        >
          + Add merchant
        </Link>
      </div>

      {merchants.length === 0 ? (
        <div className="rounded-[12px] border border-moichido-hairline bg-white p-10 text-center text-sm text-moichido-muted">
          No merchants yet. Add the first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-moichido-hairline bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-moichido-hairline text-left text-xs uppercase tracking-wide text-moichido-muted">
                <th className="px-4 py-2 font-medium">Merchant</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 font-medium">Cards</th>
                <th className="px-4 py-2 font-medium">Comp</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => {
                const count = cardCounts[m.id] ?? 0
                const limit = m.moichido_card_limit
                const suspended = m.status === 'suspended'
                return (
                  <tr key={m.id} className="border-b border-moichido-hairline/60 last:border-0 hover:bg-moichido-paper">
                    <td className="px-4 py-3">
                      <Link href={`/moichido/merchants/${m.id}`} className="font-medium text-moichido-teal hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={suspended ? 'text-moichido-apricot' : 'text-moichido-ink'}>
                        {suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-moichido-muted">{m.moichido_tier ?? '—'}</td>
                    <td className="px-4 py-3 text-moichido-ink">
                      {count}{limit != null ? ` / ${limit}` : ''}
                    </td>
                    <td className="px-4 py-3 text-moichido-muted">{compActive[m.id] ? 'Comped' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
