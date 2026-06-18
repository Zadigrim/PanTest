import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MerchantForms } from './MerchantForms'

export const dynamic = 'force-dynamic'

export default async function MerchantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: merchant } = await db
    .from('institutions')
    .select('id, name, institution_type, status, moichido_tier, moichido_card_limit, moichido_recorded_amount_cents')
    .eq('id', id)
    .eq('institution_type', 'moichido_merchant')
    .maybeSingle()
  if (!merchant) notFound()

  // Linked accounts + capabilities, with display names.
  const { data: authz } = await db
    .from('employee_authorizations')
    .select('user_id, can_verify, can_distribute_prizes, profiles(display_name)')
    .eq('institution_id', id)
  const authorizations = ((authz ?? []) as Array<{
    user_id: string
    can_verify: boolean | null
    can_distribute_prizes: boolean | null
    profiles: { display_name: string | null } | null
  }>).map((a) => ({
    userId: a.user_id,
    displayName: a.profiles?.display_name ?? a.user_id.slice(0, 8),
    canVerify: a.can_verify === true,
    canDistributePrizes: a.can_distribute_prizes === true,
  }))

  // Real card count (consumable passports) + active comp.
  const { count: cardCount } = await db
    .from('passports')
    .select('id', { count: 'exact', head: true })
    .eq('proprietor_id', id)
    .eq('credential_type', 'consumable')

  const { data: comp } = await db
    .from('comp_subscriptions')
    .select('note, expires_at')
    .eq('institution_id', id)
    .is('revoked_at', null)
    .maybeSingle()

  const limit = merchant.moichido_card_limit as number | null
  const used = cardCount ?? 0

  return (
    <div className="max-w-3xl">
      <Link href="/moichido/merchants" className="text-sm text-moichido-teal hover:underline">
        ← All merchants
      </Link>
      <div className="mt-2 mb-5 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-moichido-ink">{merchant.name}</h1>
        <span className="text-sm text-moichido-muted">
          {used}{limit != null ? ` / ${limit}` : ''} card{used === 1 ? '' : 's'}
          {limit != null && used >= limit ? ' · limit reached' : ''}
        </span>
      </div>

      <MerchantForms
        merchant={{
          id: merchant.id,
          status: merchant.status ?? 'active',
          moichidoTier: merchant.moichido_tier ?? null,
          moichidoCardLimit: limit,
          moichidoRecordedAmountCents: merchant.moichido_recorded_amount_cents ?? null,
        }}
        authorizations={authorizations}
        comp={{ active: !!comp, note: comp?.note ?? null, expiresAt: comp?.expires_at ?? null }}
      />
    </div>
  )
}
