'use client'

import { useState } from 'react'

type FormState = 'idle' | 'pending' | 'success' | 'error'

interface Result {
  state: FormState
  message?: string
  payload?: unknown
}

function ResultBox({ result }: { result: Result }) {
  if (result.state === 'idle') return null
  const tone =
    result.state === 'success' ? 'border-green bg-green/5 text-ink'
    : result.state === 'error' ? 'border-accent bg-accent/5 text-ink'
    : 'border-hairline bg-paper text-muted'
  return (
    <div className={`mt-3 rounded-card border px-3 py-2 text-xs ${tone}`}>
      {result.message && <p className="font-medium">{result.message}</p>}
      {result.payload != null && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-muted">
          {JSON.stringify(result.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

function IssueTokenForm() {
  const [stopId, setStopId] = useState('')
  const [ttl, setTtl] = useState('300')
  const [result, setResult] = useState<Result>({ state: 'idle' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult({ state: 'pending', message: 'Issuing…' })
    try {
      const res = await fetch('/api/m3/issue-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_id: stopId.trim(), ttl_seconds: Number(ttl) || 300 }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ state: 'error', message: body?.error ?? `HTTP ${res.status}` })
        return
      }
      setResult({ state: 'success', message: 'Token issued', payload: body })
    } catch (err) {
      setResult({ state: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-hairline bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">1. Issue one-off stop token</h2>
      <p className="mt-1 text-xs text-muted">
        Vendor-side. Auth requires creator / can_verify / can_distribute_prizes / platform-admin.
        Token is displayed once; consume it via form 2.
      </p>
      <label className="mt-3 block text-xs font-medium text-ink">
        Stop ID
        <input
          required
          value={stopId}
          onChange={(e) => setStopId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 font-mono text-xs"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-ink">
        TTL (seconds, 1..86400)
        <input
          value={ttl}
          onChange={(e) => setTtl(e.target.value)}
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
        />
      </label>
      <button
        type="submit"
        disabled={result.state === 'pending'}
        className="mt-3 w-full rounded-card bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        {result.state === 'pending' ? 'Issuing…' : 'Issue token'}
      </button>
      <ResultBox result={result} />
    </form>
  )
}

function ConsumeTokenForm() {
  const [token, setToken] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [result, setResult] = useState<Result>({ state: 'idle' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult({ state: 'pending', message: 'Consuming…' })
    try {
      const body: Record<string, unknown> = { token: token.trim() }
      if (lat.trim()) body.lat = Number(lat)
      if (lng.trim()) body.lng = Number(lng)
      const res = await fetch('/api/m3/consume-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ state: 'error', message: data?.error ?? `HTTP ${res.status}` })
        return
      }
      setResult({ state: 'success', message: 'Punch recorded', payload: data })
    } catch (err) {
      setResult({ state: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-hairline bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">2. Consume token + punch</h2>
      <p className="mt-1 text-xs text-muted">
        Collector-side. Caller must own a consumable passport with an active card. Lat/lng required
        only for GPS-tier stops.
      </p>
      <label className="mt-3 block text-xs font-medium text-ink">
        Token
        <input
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="M3-…"
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 font-mono text-xs"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-ink">
          Latitude (optional)
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
          />
        </label>
        <label className="block text-xs font-medium text-ink">
          Longitude (optional)
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={result.state === 'pending'}
        className="mt-3 w-full rounded-card bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        {result.state === 'pending' ? 'Consuming…' : 'Consume + punch'}
      </button>
      <ResultBox result={result} />
    </form>
  )
}

function RedeemCompletionForm() {
  const [code, setCode] = useState('')
  const [action, setAction] = useState<'distributed' | 'pending'>('distributed')
  const [note, setNote] = useState('')
  const [extraCents, setExtraCents] = useState('')
  const [result, setResult] = useState<Result>({ state: 'idle' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult({ state: 'pending', message: 'Redeeming…' })
    try {
      const res = await fetch('/api/token/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenCode: code.trim().toUpperCase(),
          action,
          note: note.trim() || undefined,
          extraGiftCardCents: extraCents.trim() ? Number(extraCents) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ state: 'error', message: data?.error ?? `HTTP ${res.status}` })
        return
      }
      setResult({ state: 'success', message: 'Redeemed', payload: data })
    } catch (err) {
      setResult({ state: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-hairline bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">3. Redeem completion token</h2>
      <p className="mt-1 text-xs text-muted">
        Employee-side. Works for both persistent (McMenamins-style) and consumable (moichido) tokens.
        For consumable + reissue_on_completion=true, the next card_instance is issued automatically.
      </p>
      <label className="mt-3 block text-xs font-medium text-ink">
        Token code
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="OKJ-XXXX-XX"
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 font-mono text-xs uppercase"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-ink">
        Action
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as 'distributed' | 'pending')}
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
        >
          <option value="distributed">distributed (requires can_distribute_prizes)</option>
          <option value="pending">pending (requires can_verify only)</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-ink">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-ink">
        Extra gift card (cents, optional)
        <input
          value={extraCents}
          onChange={(e) => setExtraCents(e.target.value)}
          className="mt-1 w-full rounded-card border border-hairline px-3 py-2 text-xs"
        />
      </label>
      <button
        type="submit"
        disabled={result.state === 'pending'}
        className="mt-3 w-full rounded-card bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        {result.state === 'pending' ? 'Redeeming…' : 'Redeem'}
      </button>
      <ResultBox result={result} />
    </form>
  )
}

export function M3TestClient() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[3px] text-muted">Internal</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">M3 consumable test surface</h1>
        <p className="mt-1 text-sm text-muted">
          End-to-end exercise of the M3 function surface: issue → consume + punch → redeem. Full
          merchant UI ships in M4; this page is the testing affordance.
        </p>
      </header>
      <div className="space-y-4">
        <IssueTokenForm />
        <ConsumeTokenForm />
        <RedeemCompletionForm />
      </div>
    </main>
  )
}
