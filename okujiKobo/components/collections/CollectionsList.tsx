'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PassportCollection } from '@/lib/collections/types'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'collection'
}

export function CollectionsList({ initial }: { initial: PassportCollection[] }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    const t = title.trim()
    if (!t) return
    setCreating(true)
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setCreating(false); return }
    // slug is UNIQUE; suffix a short random token to avoid collisions.
    const slug = `${slugify(t)}-${Math.random().toString(36).slice(2, 7)}`
    const { data, error } = await db
      .from('passport_collections')
      .insert({ owner_id: user.id, title: t, slug })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { alert(error?.message ?? 'Could not create the collection.'); return }
    router.push(`/collections/${data.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          placeholder="New collection title"
          className="h-9 flex-1 rounded border border-hairline px-3 text-sm text-navy"
        />
        <button
          onClick={create}
          disabled={creating || !title.trim()}
          className="h-9 rounded bg-green px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New collection'}
        </button>
      </div>

      {initial.length === 0 ? (
        <p className="text-sm text-muted">No collections yet — create one above.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded border border-hairline">
          {initial.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-paper">
                <span className="text-sm font-medium text-ink">{c.title}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  {c.status}{c.is_okuji_official ? ' · official' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
