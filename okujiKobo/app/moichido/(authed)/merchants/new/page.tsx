'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createMerchant } from '../actions'

const input =
  'h-9 w-full rounded-[8px] border border-moichido-hairline bg-white px-3 text-sm text-moichido-ink focus:outline-none focus:ring-2 focus:ring-moichido-teal'

export default function NewMerchantPage() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [canVerify, setCanVerify] = useState(true)
  const [canDistribute, setCanDistribute] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    start(async () => {
      const r = await createMerchant({
        name,
        ownerEmail: email,
        canVerify,
        canDistributePrizes: canDistribute,
      })
      if (r.ok && r.id) router.push(`/moichido/merchants/${r.id}`)
      else if (!r.ok) setError(r.error)
    })
  }

  return (
    <div className="max-w-lg">
      <Link href="/moichido/merchants" className="text-sm text-moichido-teal hover:underline">
        ← All merchants
      </Link>
      <h1 className="mt-2 mb-5 text-2xl font-bold text-moichido-ink">Add merchant</h1>

      <div className="space-y-4 rounded-[12px] border border-moichido-hairline bg-white p-6">
        {error && (
          <p className="rounded-[8px] border border-moichido-apricot bg-moichido-apricot/10 px-3 py-2 text-sm text-moichido-ink">
            {error}
          </p>
        )}
        <label className="block">
          <span className="text-sm font-medium text-moichido-ink">Business name</span>
          <input className={`mt-1 ${input}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bay Street Coffee" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-moichido-ink">Owner email</span>
          <input
            className={`mt-1 ${input}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
          />
          <span className="mt-1 block text-xs text-moichido-muted">
            Must already have an okuji account — the owner signs up first, then you link them here.
          </span>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-moichido-ink">Initial capabilities</legend>
          <label className="flex items-center gap-2 text-sm text-moichido-muted">
            <input type="checkbox" checked={canVerify} onChange={(e) => setCanVerify(e.target.checked)} />
            Issue / verify punches
          </label>
          <label className="flex items-center gap-2 text-sm text-moichido-muted">
            <input type="checkbox" checked={canDistribute} onChange={(e) => setCanDistribute(e.target.checked)} />
            Redeem / distribute prizes
          </label>
        </fieldset>
        <button
          type="button"
          disabled={pending || !name.trim() || !email.trim()}
          onClick={submit}
          className="w-full rounded-[8px] bg-moichido-teal px-4 py-2 text-sm font-semibold text-moichido-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create merchant'}
        </button>
      </div>
    </div>
  )
}
