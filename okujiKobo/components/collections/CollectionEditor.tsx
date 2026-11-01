'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PassportCollection, CollectionReward, MemberPassport, RewardKind } from '@/lib/collections/types'

interface MemberRow { passport_id: string; position: number; passport: MemberPassport }

export function CollectionEditor({
  collection, members, rewards, myPassports,
}: {
  collection: PassportCollection
  members: MemberRow[]
  rewards: CollectionReward[]
  myPassports: MemberPassport[]
}) {
  const router = useRouter()
  // Collections tables post-date the generated types snapshot — use a loose
  // client (repo convention). Writes are still enforced by RLS (migration 111).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  // reward form
  const [rKind, setRKind] = useState<RewardKind>('count')
  const [rCount, setRCount] = useState('5')
  const [rTitle, setRTitle] = useState('')
  const [rDesc, setRDesc] = useState('')

  const memberIds = useMemo(() => new Set(members.map((m) => m.passport_id)), [members])
  const addable = useMemo(
    () => myPassports
      .filter((p) => !memberIds.has(p.id))
      .filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase())),
    [myPassports, memberIds, search],
  )
  const publishedCount = members.filter((m) => m.passport?.status === 'published').length

  const run = async (fn: () => Promise<{ error: unknown } | void>) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res && 'error' in res && res.error) { alert((res.error as { message?: string })?.message ?? 'Save failed'); return }
    router.refresh()
  }

  const patch = (p: Partial<PassportCollection>) =>
    run(() => db.from('passport_collections').update(p).eq('id', collection.id).then((r: any) => ({ error: r.error })))

  const setStatus = (status: PassportCollection['status']) =>
    patch(status === 'published' ? { status, published_at: new Date().toISOString() } : { status })

  const addPassport = (passportId: string) =>
    run(() => db.from('passport_collection_items')
      .insert({ collection_id: collection.id, passport_id: passportId, position: members.length })
      .then((r: any) => ({ error: r.error })))

  const removePassport = (passportId: string) =>
    run(() => db.from('passport_collection_items')
      .delete().eq('collection_id', collection.id).eq('passport_id', passportId)
      .then((r: any) => ({ error: r.error })))

  const addReward = () => {
    const title = rTitle.trim()
    if (!title) { alert('Give the reward a title.'); return }
    const count = rKind === 'count' ? Math.max(1, parseInt(rCount, 10) || 0) : null
    if (rKind === 'count' && (!count || count < 1)) { alert('Count must be ≥ 1.'); return }
    // badge_key is globally unique (idempotency key in collector_badges).
    const badge_key = `col_${collection.slug}_${rKind}${count ?? ''}_${Math.random().toString(36).slice(2, 7)}`
    run(() => db.from('passport_collection_rewards').insert({
      collection_id: collection.id, kind: rKind, required_count: count,
      badge_key, title, description: rDesc.trim() || null,
    }).then((r: any) => ({ error: r.error }))).then(() => { setRTitle(''); setRDesc('') })
  }

  const removeReward = (id: string) =>
    run(() => db.from('passport_collection_rewards').delete().eq('id', id).then((r: any) => ({ error: r.error })))

  const field = 'h-9 w-full rounded border border-hairline px-3 text-sm text-navy'
  const h3 = 'text-xs font-semibold uppercase tracking-wider text-muted'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/collections" className="text-sm text-muted hover:text-ink">← Collections</Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            {collection.status}{collection.is_okuji_official ? ' · official' : ''}
          </span>
          {collection.status !== 'published' && (
            <button disabled={busy} onClick={() => setStatus('published')} className="h-8 rounded bg-green px-3 text-xs font-semibold text-white disabled:opacity-50">Publish</button>
          )}
          {collection.status === 'published' && (
            <button disabled={busy} onClick={() => setStatus('draft')} className="h-8 rounded border border-hairline px-3 text-xs font-semibold text-navy disabled:opacity-50">Unpublish</button>
          )}
          {collection.status !== 'archived' && (
            <button disabled={busy} onClick={() => setStatus('archived')} className="h-8 rounded border border-hairline px-3 text-xs font-semibold text-muted disabled:opacity-50">Archive</button>
          )}
          {collection.status === 'archived' && (
            <button disabled={busy} onClick={() => setStatus('draft')} className="h-8 rounded border border-hairline px-3 text-xs font-semibold text-navy disabled:opacity-50">Restore to draft</button>
          )}
        </div>
      </div>

      {/* Details */}
      <section className="space-y-3">
        <h3 className={h3}>Details</h3>
        <input className={field + ' text-base font-semibold'} defaultValue={collection.title}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== collection.title) patch({ title: v }) }} placeholder="Title" />
        <input className={field} defaultValue={collection.subtitle ?? ''}
          onBlur={(e) => patch({ subtitle: e.target.value.trim() || null })} placeholder="Subtitle (optional)" />
        <textarea className={field.replace('h-9', 'min-h-[72px] py-2')} defaultValue={collection.description ?? ''}
          onBlur={(e) => patch({ description: e.target.value.trim() || null })} placeholder="Description (optional)" />
        <input className={field} defaultValue={collection.edition_label ?? ''}
          onBlur={(e) => patch({ edition_label: e.target.value.trim() || null })} placeholder="Edition label, e.g. 2027 (display only)" />
        <p className="text-[11px] text-muted">Slug: {collection.slug} · Cover asset id (optional):</p>
        <input className={field} defaultValue={collection.cover_asset_id ?? ''}
          onBlur={(e) => patch({ cover_asset_id: e.target.value.trim() || null })} placeholder="design_assets id for the cover (optional)" />
      </section>

      {/* Member passports */}
      <section className="space-y-3">
        <h3 className={h3}>Passports in this collection ({members.length}) · {publishedCount} published</h3>
        {members.length === 0 ? (
          <p className="text-sm text-muted">None yet — add from your passports below.</p>
        ) : (
          <ul className="divide-y divide-hairline rounded border border-hairline">
            {members.map((m) => (
              <li key={m.passport_id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-ink">{m.passport?.title ?? m.passport_id}
                  <span className="ml-2 text-[10.5px] uppercase text-muted">{m.passport?.status}</span>
                </span>
                <button disabled={busy} onClick={() => removePassport(m.passport_id)} className="text-xs text-red disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your passports to add…" />
        {search.trim() && (
          <ul className="max-h-48 overflow-auto divide-y divide-hairline rounded border border-hairline">
            {addable.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">No matches.</li>
            ) : addable.slice(0, 20).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-ink">{p.title}<span className="ml-2 text-[10.5px] uppercase text-muted">{p.status}</span></span>
                <button disabled={busy} onClick={() => addPassport(p.id)} className="text-xs font-semibold text-green disabled:opacity-50">Add</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rewards */}
      <section className="space-y-3">
        <h3 className={h3}>Reward badges</h3>
        {rewards.length > 0 && (
          <ul className="divide-y divide-hairline rounded border border-hairline">
            {rewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-ink">{r.title}
                  <span className="ml-2 text-[11px] text-muted">{r.kind === 'all' ? 'complete all' : `complete ${r.required_count}`}</span>
                </span>
                <button disabled={busy} onClick={() => removeReward(r.id)} className="text-xs text-red disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded border border-hairline p-3">
          <label className="text-xs text-muted">Kind
            <select value={rKind} onChange={(e) => setRKind(e.target.value as RewardKind)} className="ml-2 h-8 rounded border border-hairline px-2 text-sm text-navy">
              <option value="count">Complete N</option>
              <option value="all">Complete all</option>
            </select>
          </label>
          {rKind === 'count' && (
            <label className="text-xs text-muted">N
              <input type="number" min={1} value={rCount} onChange={(e) => setRCount(e.target.value)} className="ml-2 h-8 w-20 rounded border border-hairline px-2 text-sm text-navy" />
            </label>
          )}
          <input className="h-8 flex-1 rounded border border-hairline px-2 text-sm text-navy" value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Badge title" />
          <input className="h-8 flex-1 rounded border border-hairline px-2 text-sm text-navy" value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder="Description (optional)" />
          <button disabled={busy} onClick={addReward} className="h-8 rounded bg-green px-3 text-xs font-semibold text-white disabled:opacity-50">Add reward</button>
        </div>
      </section>
    </div>
  )
}
