import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RingMark } from '@/components/moichido/marks/RingMark'
import { NewCardButton } from '@/components/moichido/designer/NewCardButton'

/**
 * /moichido/cards — list of the merchant's punch cards.
 *
 * Same merchant resolution as the home page: caller's
 * employee_authorizations joined to institutions with
 * institution_type='moichido_merchant'. No merchant access → bounce
 * to denied. Otherwise pull the consumable passports at the
 * merchant's institution and list them.
 *
 * Honest data: an empty cards list shows the honest "no cards yet"
 * state — never sample data.
 */
export const metadata = { title: 'Cards · moichido' }

export default async function CardsListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: authzRows } = await db
    .from('employee_authorizations')
    .select('institution_id, institutions!inner(id, name, institution_type)')
    .eq('user_id', user.id)
    .eq('institutions.institution_type', 'moichido_merchant')

  const merchant = ((authzRows ?? []) as Array<{
    institutions: { id: string; name: string }
  }>)[0]?.institutions
  if (!merchant) redirect('/moichido/auth/denied')

  const { data: cards } = await db
    .from('passports')
    .select('id, title, created_at, consumable_target_count')
    .eq('proprietor_id', merchant.id)
    .eq('credential_type', 'consumable')
    .order('created_at', { ascending: false })

  const list = (cards ?? []) as Array<{
    id: string; title: string; created_at: string; consumable_target_count: number | null
  }>

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[3px] text-moichido-muted">
            {merchant.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-moichido-ink">Cards</h1>
        </div>
        <NewCardButton />
      </header>

      {list.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-moichido-hairline bg-white p-10 text-center">
          <span className="text-moichido-teal inline-block"><RingMark size={48} strokeWidth={2} /></span>
          <p className="mt-4 text-sm font-medium text-moichido-ink">No cards yet</p>
          <p className="mt-1 text-xs text-moichido-muted">
            Start your first punch card to see it here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <li key={card.id}>
              <Link
                href={`/moichido/cards/${card.id}/edit`}
                className="block rounded-[12px] border border-moichido-hairline bg-white p-5 hover:border-moichido-teal transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-moichido-teal"><RingMark size={28} strokeWidth={2.4} /></span>
                  <span className="text-[10px] uppercase tracking-wider text-moichido-muted">
                    {card.consumable_target_count ?? 10}-punch
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-moichido-ink truncate">
                  {card.title || 'Untitled card'}
                </p>
                <p className="mt-0.5 text-[11px] text-moichido-muted">
                  Created {new Date(card.created_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
