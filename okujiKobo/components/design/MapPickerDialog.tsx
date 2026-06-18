'use client'

// Google Maps coordinate picker. Opens a modal map, lets the user drop /
// drag a pin, returns lat/lng on confirm. Manual lat/lng entry on the
// parent form is the baseline; this is a convenience layer.
//
// Graceful degradation: read NEXT_PUBLIC_GOOGLE_MAPS_API_KEY at module
// scope. When unset, the parent component renders nothing for the picker
// trigger — this dialog is never opened. No script tag is appended, no
// console errors, no broken map container.

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loadGoogleMaps, MAPS_API_KEY, MAPS_PICKER_AVAILABLE } from '@/lib/maps/loader'
import type { ResolvedPlace } from '@/lib/maps/types'

// Back-compat re-exports so existing imports still work.
export { MAPS_API_KEY, MAPS_PICKER_AVAILABLE }

interface MapPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLat: number | null
  initialLng: number | null
  // On confirm: always the picked coordinates, plus the SERVER-resolved
  // address (null if the server Geocoding key is unset or nothing matched —
  // the caller then keeps the coordinates and leaves the address manual).
  onConfirm: (lat: number, lng: number, place: ResolvedPlace | null) => void
}

// Sensible default when there's no prior pin: continental-US centroid.
// Just a starting view; the user will move the pin to where they want.
const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 }
const DEFAULT_ZOOM_NO_PIN = 4
const DEFAULT_ZOOM_WITH_PIN = 13

export function MapPickerDialog({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  onConfirm,
}: MapPickerDialogProps) {
  // State-backed callback ref (not useRef): guarantees the effect below runs
  // only once the map container is actually in the DOM. A plain ref + an
  // [open]-gated effect races Radix's portaled/animated content — the effect
  // could fire before the node mounts and then never retry (the blank-map bug).
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  )
  // Recenter + drop-pin hook for the search box. The map + marker are created
  // inside the effect below; this ref lets the search handler drive them.
  const setPinAtRef = useRef<((lat: number, lng: number) => void) | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Search: forward-geocode the query SERVER-SIDE (one call per submit, same
  // server key as reverse-geocode — no client Places SKU), then recenter the
  // map and drop the pin on the result. Failure degrades to a hint; it never
  // moves the map or blocks anything else.
  async function handleSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch('/api/maps/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const json = res.ok ? ((await res.json()) as { place?: ResolvedPlace | null }) : null
      const place = json?.place ?? null
      if (place) {
        setPinAtRef.current?.(place.lat, place.lng)
      } else {
        setSearchError('No match — try a more specific place or address.')
      }
    } catch {
      setSearchError('Search failed — try again.')
    } finally {
      setSearching(false)
    }
  }

  // Confirm: reverse-geocode the pin SERVER-SIDE (one call, on confirm only —
  // not per drag) to fetch the address, then hand coords + address to the
  // parent. Any failure degrades to coords-only; never blocks the confirm.
  async function handleConfirm() {
    if (!pin) return
    setResolving(true)
    let place: ResolvedPlace | null = null
    try {
      const res = await fetch('/api/maps/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pin.lat, lng: pin.lng }),
      })
      if (res.ok) {
        const json = (await res.json()) as { place?: ResolvedPlace | null }
        place = json.place ?? null
      }
    } catch {
      // Network/parse failure — keep coords, drop the address.
    }
    setResolving(false)
    onConfirm(pin.lat, pin.lng, place)
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open || !mapEl) return

    let cancelled = false
    let marker: { setPosition: (p: { lat: number; lng: number }) => void } | null = null

    loadGoogleMaps()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((maps: any) => {
        if (cancelled || !mapEl) return

        const startCenter =
          initialLat != null && initialLng != null
            ? { lat: initialLat, lng: initialLng }
            : DEFAULT_CENTER
        const startZoom =
          initialLat != null && initialLng != null ? DEFAULT_ZOOM_WITH_PIN : DEFAULT_ZOOM_NO_PIN

        const map = new maps.Map(mapEl, {
          center: startCenter,
          zoom: startZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        marker = new maps.Marker({
          map,
          position: startCenter,
          draggable: true,
          visible: initialLat != null && initialLng != null,
        }) as { setPosition: (p: { lat: number; lng: number }) => void }

        const setPinAt = (lat: number, lng: number) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(marker as any).setPosition({ lat, lng })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(marker as any).setVisible(true)
          setPin({ lat, lng })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const placePin = (latLng: any) => setPinAt(latLng.lat(), latLng.lng())

        // Search recenters the map and drops the pin on the match.
        setPinAtRef.current = (lat: number, lng: number) => {
          map.setCenter({ lat, lng })
          map.setZoom(DEFAULT_ZOOM_WITH_PIN)
          setPinAt(lat, lng)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.addListener('click', (e: any) => placePin(e.latLng))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(marker as any).addListener('dragend', (e: any) => placePin(e.latLng))

        // The map is created inside an animated Radix dialog, so its
        // container often has no final size on the first paint — Google Maps
        // then renders blank with NO console error. Trigger a resize +
        // recenter once layout settles (next frames + a fallback timeout).
        const recenter = () => {
          if (cancelled) return
          maps.event.trigger(map, 'resize')
          map.setCenter(startCenter)
        }
        requestAnimationFrame(() => requestAnimationFrame(recenter))
        setTimeout(recenter, 300)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
      setPinAtRef.current = null
    }
  }, [open, mapEl, initialLat, initialLng])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-modal bg-white p-4 shadow-xl"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-base font-semibold text-navy">
            Pick a location
          </Dialog.Title>
          <p className="mt-1 text-xs text-muted">
            Click or drag the pin to set this stop&apos;s GPS target, then confirm — the address
            fills in automatically. Close enough is fine; the verification radius does the actual
            matching.
          </p>

          {/* Search — forward-geocode to jump the map to a place/address. */}
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="text"
              placeholder="Search a place or address…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch() } }}
              className="h-8 flex-1 text-xs"
            />
            <Button
              variant="default"
              size="sm"
              disabled={searching || !searchQuery.trim()}
              onClick={() => void handleSearch()}
            >
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {searchError && <p className="mt-1 text-xs text-red-600">{searchError}</p>}

          <div
            className="mt-2 w-full overflow-hidden rounded-card border border-hairline bg-cream"
            style={{ height: '60vh', minHeight: 360 }}
          >
            {loadError ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
                Couldn&apos;t load Google Maps ({loadError}). Close this dialog and enter coordinates
                manually.
              </div>
            ) : (
              <div ref={setMapEl} style={{ width: '100%', height: '100%' }} />
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.000001"
                placeholder="Lat"
                value={pin?.lat ?? ''}
                onChange={(e) =>
                  setPin((p) => ({
                    lat: e.target.value ? Number(e.target.value) : 0,
                    lng: p?.lng ?? 0,
                  }))
                }
                className="h-8 text-xs"
              />
              <Input
                type="number"
                step="0.000001"
                placeholder="Lng"
                value={pin?.lng ?? ''}
                onChange={(e) =>
                  setPin((p) => ({
                    lat: p?.lat ?? 0,
                    lng: e.target.value ? Number(e.target.value) : 0,
                  }))
                }
                className="h-8 text-xs"
              />
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="default"
              size="sm"
              disabled={!pin || resolving}
              onClick={() => void handleConfirm()}
            >
              {resolving ? 'Resolving address…' : 'Use these coordinates'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
