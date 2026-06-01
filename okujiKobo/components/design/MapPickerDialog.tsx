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

// Public env var — exposed to the browser bundle. Empty string when unset.
export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
export const MAPS_PICKER_AVAILABLE = MAPS_API_KEY.length > 0

// Module-level loader promise so multiple opens share a single <script> tag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mapsLoader: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadGoogleMaps(): Promise<any> {
  if (!MAPS_PICKER_AVAILABLE) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY unset'))
  if (mapsLoader) return mapsLoader

  mapsLoader = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as unknown as { google?: { maps: any } }
    if (w.google?.maps) {
      resolve(w.google.maps)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (w.google?.maps) resolve(w.google.maps)
      else reject(new Error('google.maps unavailable after script load'))
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return mapsLoader
}

interface MapPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLat: number | null
  initialLng: number | null
  onConfirm: (lat: number, lng: number) => void
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  )

  useEffect(() => {
    if (!open || !containerRef.current) return

    let cancelled = false
    let marker: { setPosition: (p: { lat: number; lng: number }) => void } | null = null

    loadGoogleMaps()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((maps: any) => {
        if (cancelled || !containerRef.current) return

        const startCenter =
          initialLat != null && initialLng != null
            ? { lat: initialLat, lng: initialLng }
            : DEFAULT_CENTER
        const startZoom =
          initialLat != null && initialLng != null ? DEFAULT_ZOOM_WITH_PIN : DEFAULT_ZOOM_NO_PIN

        const map = new maps.Map(containerRef.current, {
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const placePin = (latLng: any) => {
          const lat = latLng.lat()
          const lng = latLng.lng()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(marker as any).setPosition({ lat, lng })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(marker as any).setVisible(true)
          setPin({ lat, lng })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.addListener('click', (e: any) => placePin(e.latLng))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(marker as any).addListener('dragend', (e: any) => placePin(e.latLng))
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [open, initialLat, initialLng])

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
            Click or drag the pin to set this stop&apos;s GPS target. Close enough is fine — the
            verification radius does the actual matching.
          </p>

          <div className="mt-3 h-[60vh] w-full overflow-hidden rounded-card border border-hairline bg-cream">
            {loadError ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
                Couldn&apos;t load Google Maps ({loadError}). Close this dialog and enter coordinates
                manually.
              </div>
            ) : (
              <div ref={containerRef} className="h-full w-full" />
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
              disabled={!pin}
              onClick={() => {
                if (pin) {
                  onConfirm(pin.lat, pin.lng)
                  onOpenChange(false)
                }
              }}
            >
              Use these coordinates
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
