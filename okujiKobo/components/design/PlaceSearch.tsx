'use client'

// Place search input — wraps the browser Places client with the UX:
//   • Debounced input (300 ms) — one Autocomplete call per typing
//     pause, not per keystroke.
//   • Session token — minted on focus, regenerated after each
//     successful selection. Google bills a search-and-select session
//     as one Place Details request and the keystroke Autocomplete
//     calls inside it as free.
//   • Dropdown of structured predictions; click to select.
//   • Returns a ResolvedPlace to the parent via onSelect, which is
//     what fills the stop's address + lat/lng fields.
//
// Graceful degradation: when the Maps key isn't set, the component
// renders nothing. The parent's manual fields + the map picker keep
// working unchanged.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  placesAvailable,
  createAutocompleteSession,
  getPlacePredictions,
  getPlaceDetails,
  type AutocompleteSessionToken,
  type PlacePrediction,
} from '@/lib/maps/client-places'
import type { ResolvedPlace } from '@/lib/maps/types'
import { Input } from './ui/Input'
import { Label } from './ui/Label'

const DEBOUNCE_MS = 300

interface Props {
  /** Called when the user picks a prediction and Place Details
   *  resolves. The parent fills its own fields from the result. */
  onSelect: (place: ResolvedPlace) => void
  /** Placeholder for the input. Defaults to something sensible. */
  placeholder?: string
  /** Optional locality biasing hint added to the input. Not used
   *  programmatically yet — present so callers can label what's
   *  being searched ("Search for a place in this passport's region"). */
  hint?: string
}

export function PlaceSearch({ onSelect, placeholder, hint }: Props) {
  // Hide entirely when the Maps key isn't configured. This is the
  // graceful-degradation path: no input rendered, no error message,
  // no warning — the parent's manual fields are the user surface.
  if (!placesAvailable()) return null

  return <PlaceSearchInner onSelect={onSelect} placeholder={placeholder} hint={hint} />
}

function PlaceSearchInner({ onSelect, placeholder, hint }: Props) {
  const [query,        setQuery]        = useState('')
  const [predictions,  setPredictions]  = useState<PlacePrediction[]>([])
  const [open,         setOpen]         = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [resolving,    setResolving]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const sessionRef = useRef<AutocompleteSessionToken | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Lazy-mint the session on first focus rather than on mount, so a
  // stop panel that's opened but never used doesn't burn a session.
  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    try {
      sessionRef.current = await createAutocompleteSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place search unavailable')
    }
    return sessionRef.current
  }, [])

  // Run the debounced search when query changes.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 2) {
      setPredictions([])
      return
    }
    timerRef.current = setTimeout(async () => {
      const session = await ensureSession()
      if (!session) return
      setLoading(true)
      try {
        const results = await getPlacePredictions(query, session)
        setPredictions(results)
        setOpen(results.length > 0)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, ensureSession])

  // Close dropdown on outside click.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handlePick = useCallback(async (prediction: PlacePrediction) => {
    const session = sessionRef.current
    if (!session) return
    setResolving(true)
    setOpen(false)
    try {
      const place = await getPlaceDetails(prediction.place_id, session)
      if (place) {
        onSelect(place)
        // Show the picked label in the field so the user sees what they
        // chose. The parent stop name stays in the parent input.
        setQuery(place.formatted_address ?? prediction.description)
      } else {
        setError('Couldn’t load place details for that result.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place details failed')
    } finally {
      setResolving(false)
      // A new search starts a new billed session — fresh token next time.
      sessionRef.current = null
    }
  }, [onSelect])

  return (
    <div ref={wrapperRef} className="relative space-y-1">
      <Label className="text-xs text-muted">
        Search for a place {hint ? <span className="text-muted/70">· {hint}</span> : null}
      </Label>
      <Input
        value={query}
        placeholder={placeholder ?? 'e.g. Bainbridge Island Museum of Art'}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { void ensureSession(); if (predictions.length > 0) setOpen(true) }}
        className="h-8 text-sm"
        disabled={resolving}
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-card border border-hairline bg-white shadow-lg">
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                onClick={() => void handlePick(p)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-cream"
              >
                <span className="block text-sm text-navy">{p.main_text}</span>
                {p.secondary_text && (
                  <span className="block text-xs text-muted">{p.secondary_text}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="text-xs text-muted">Searching…</p>}
      {resolving && <p className="text-xs text-muted">Resolving…</p>}
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  )
}
