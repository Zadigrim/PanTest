'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  usePassportStore,
  selectActivePage,
  selectSelectedStop,
  selectSelectedStopPage,
  selectSelectedElement,
} from '@/lib/design/passport-store'
import { CLASSIFIERS } from '@/lib/design/classifiers'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Button } from './ui/Button'
import { ColorPickerInput } from './ui/ColorPickerInput'
import { MapPickerDialog, MAPS_PICKER_AVAILABLE } from './MapPickerDialog'
import { PlaceSearch } from './PlaceSearch'
import type { ResolvedPlace } from '@/lib/maps/types'
import { AssetDeleteButton } from './AssetDeleteButton'
import { safeUpdate, safeInsert } from '@/lib/design/persist'
import type {
  DesignerStop,
  DesignerPassportPage,
  BackgroundType,
  DesignerPageElement,
  PassportType,
  ImagePageElement,
  TextPageElement,
  LinePageElement,
} from '@/lib/design/types'
import type { StampAsset } from '@/lib/design/stamp-assets'

export function RightInspector({
  creatorInstitutionId,
}: {
  creatorInstitutionId: string | null
}) {
  const activePage = usePassportStore(selectActivePage)
  const selectedStop = usePassportStore(selectSelectedStop)
  // The page the selected STOP belongs to — not the active tab. The
  // previous guard checked activePage.page_type, which hid this panel
  // (and its Stop type / verification-method controls from migration
  // 046) whenever the user happened to be on an information tab, even
  // for a stop that lives on a stamp page.
  const selectedStopPage = usePassportStore(selectSelectedStopPage)
  const selectedElement = usePassportStore(selectSelectedElement)

  const label = selectedStop
    ? 'Stop'
    : selectedElement
    ? selectedElement.type === 'text'  ? 'Label'
      : selectedElement.type === 'image' ? 'Image'
      : selectedElement.type === 'line'  ? 'Line'
      : selectedElement.type === 'hline' ? 'H-Line'
      : 'V-Line'
    : activePage
    ? 'Page'
    : 'Passport'

  const title = selectedStop
    ? selectedStop.name
    : selectedElement
    ? selectedElement.type === 'text'  ? (selectedElement.content ?? '—')
      : selectedElement.type === 'image' ? 'Image element'
      : selectedElement.type === 'line'  ? 'Line'
      : selectedElement.type === 'hline' ? 'H-Line'
      : 'V-Line'
    : activePage
    ? activePage.section_title ?? activePage.section_name
    : 'No selection'

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-hairline bg-white">
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-navy">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedStop && selectedStopPage?.page_type !== 'information' ? (
          <StopInspector stop={selectedStop} creatorInstitutionId={creatorInstitutionId} />
        ) : selectedElement && activePage ? (
          <ElementInspector element={selectedElement} pageId={activePage.id} />
        ) : activePage ? (
          <PageInspector page={activePage} />
        ) : (
          <PassportInspector />
        )}
      </div>
    </aside>
  )
}

// ── Classifier / educational constants ────────────────────────────────────────

const CLASSIFIER_OPTIONS = CLASSIFIERS.map((c) => ({ value: c.id, label: c.label }))

const GRADE_LEVEL_OPTIONS = [
  { value: 'K-2',  label: 'K–2'  },
  { value: '3-5',  label: '3–5'  },
  { value: '6-8',  label: '6–8'  },
  { value: '9-12', label: '9–12' },
] as const

const SUBJECT_AREA_OPTIONS = [
  { value: 'science',      label: 'Science'      },
  { value: 'history',      label: 'History'      },
  { value: 'english',      label: 'English'      },
  { value: 'math',         label: 'Math'         },
  { value: 'art',          label: 'Art'          },
  { value: 'social',       label: 'Social'       },
  { value: 'stem',         label: 'STEM'         },
  { value: 'environment',  label: 'Environment'  },
] as const

// The per-stop "Include journal lines" checkbox and its parent
// PhysicalPassportSection were removed. Journal-line rendering on stop
// pages has been retired entirely; future journal-line support will land
// as dedicated journal pages, not as an overlay on stop pages, so the
// per-stop toggle would be the wrong shape to keep around.

// ── Stop Inspector ─────────────────────────────────────────────────────────────

// Canonical Level-2 method options shown when stop type = Location.
// The DB sync trigger (migration 046) derives verification_tier from
// these values so verify-stamp keeps its existing T1-T5 branch logic.
const LOCATION_METHODS = [
  { value: 'gps',        label: 'GPS',                hint: 'Phone confirms location within the radius. Coordinates required.' },
  { value: 'qr',         label: 'QR code',            hint: 'Visitor scans a code on-site. Address required for wayfinding.' },
  { value: 'witnessed',  label: 'Staff-witnessed',    hint: 'Staff or host signs off the visit on the terminal.' },
  { value: 'documented', label: 'Evidence-documented',hint: 'Visitor submits a photo or receipt as proof.' },
] as const
type LocationMethod = typeof LOCATION_METHODS[number]['value']

const PRESET_COLORS = [
  '1D9E75', '0D1B2A', 'C9A84C', 'D85A30',
  '7F77DD', '3A7BD5', 'B84C7D', '4CAF50',
  '9E4D1D', '6B6B6B',
]

const STAMP_ICONS = [
  // Food & drink
  '🍺','🍻','🥃','🍷','🍸','🍹','🍵','☕','🧋','🥂',
  // Places & travel
  '🏛️','⛪','🏰','🗺️','🏕️','🏠','🗼','🌉','⚓','🛤️',
  // Nature
  '🌲','🌿','🍀','🌸','🌊','🏔️','🌋','🦋','🐝','🦅',
  // Activities & objects
  '🎭','🎨','🎸','🎯','🏆','🎖️','🔑','💎','📜','⭐',
  // Misc
  '📍','📌','🏷️','🎁','🎪','🎡','🎢','🚵','🧗','🌟',
]

const SMUDGE_OPTIONS = ['none', 'light', 'medium', 'heavy'] as const

// ── StampPicker ────────────────────────────────────────────────────────────────

function StampPicker({
  stop,
  persist,
}: {
  stop: DesignerStop
  persist: (patch: Partial<DesignerStop>) => Promise<void>
}) {
  const [myAssets, setMyAssets] = useState<StampAsset[]>([])
  const [instAssets, setInstAssets] = useState<StampAsset[]>([])

  useEffect(() => {
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    void (async () => {
      const { data: { user } } = await (db as ReturnType<typeof createClient>).auth.getUser()
      if (!user) return

      const { data } = await db
        .from('design_assets')
        .select('id, name, url, thumbnail_data, file_format, is_monochrome, institution_id, owner_id')
        .eq('asset_type', 'stamp')
        .neq('is_built_in', true)
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as StampAsset[]
      setMyAssets(rows.filter((r) => r.owner_id === user.id))
      setInstAssets(rows.filter((r) => r.owner_id !== user.id))
    })()
  }, [])

  const isCustom = stop.stamp_type === 'custom_asset'

  function selectEmoji(icon: string) {
    void persist({ stamp_icon: icon, stamp_type: 'emoji', stamp_asset_id: null })
  }

  function selectAsset(asset: StampAsset) {
    void persist({ stamp_asset_id: asset.id, stamp_type: 'custom_asset', stamp_icon: '' })
  }

  const renderThumb = (asset: StampAsset) => {
    const src = asset.thumbnail_data ?? asset.url
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={asset.name ?? ''} className="h-full w-full object-contain p-0.5" />
    ) : (
      <span className="text-xs text-muted">?</span>
    )
  }

  return (
    <div className="space-y-3">
      {/* My uploads */}
      {(myAssets.length > 0 || instAssets.length > 0) && (
        <>
          {myAssets.length > 0 && (
            <div>
              <Label className="text-xs text-muted">My uploads</Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {myAssets.map((asset) => (
                  <div key={asset.id} className="group relative">
                    <button
                      onClick={() => selectAsset(asset)}
                      title={asset.name ?? ''}
                      className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-card border transition-colors ${
                        isCustom && stop.stamp_asset_id === asset.id
                          ? 'border-green bg-cream'
                          : 'border-hairline hover:border-green'
                      }`}
                    >
                      {renderThumb(asset)}
                    </button>
                    <AssetDeleteButton
                      assetId={asset.id}
                      assetName={asset.name ?? 'Untitled'}
                      onDeleted={() => setMyAssets((prev) => prev.filter((a) => a.id !== asset.id))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {instAssets.length > 0 && (
            <div>
              <Label className="text-xs text-muted">Institution stamps</Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {instAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(asset)}
                    title={asset.name ?? ''}
                    className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-card border transition-colors ${
                      isCustom && stop.stamp_asset_id === asset.id
                        ? 'border-green bg-cream'
                        : 'border-hairline hover:border-green'
                    }`}
                  >
                    {renderThumb(asset)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Built-in emoji */}
      <div>
        <Label className="text-xs text-muted">Built-in stamps</Label>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {STAMP_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => selectEmoji(icon)}
              title={icon}
              className={`h-7 w-7 rounded-card border text-base leading-none transition-colors hover:border-green ${
                !isCustom && stop.stamp_icon === icon
                  ? 'border-green bg-cream'
                  : 'border-hairline'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Location section ──────────────────────────────────────────────────────────
//
// Canonical two-level model (migration 046):
//   Level 1 — experience_type:
//     'location'   → physical place; surfaces method + address + coords
//     'experience' → not a physical place (book, workshop, activity);
//                    forced honor-system, no address / coords inputs
//   Level 2 — experience_verification_method (only when Location):
//     'gps'        → lat/lng REQUIRED  (drives verification_tier = 3)
//     'qr'         → address REQUIRED  (drives verification_tier = 2)
//     'witnessed'  → both OPTIONAL     (drives verification_tier = 4)
//     'documented' → both OPTIONAL     (drives verification_tier = 5)
//
// verification_tier is derived server-side by the migration-046 trigger,
// so the designer never reads or writes it directly. The legacy
// location_type column (migration 042) is retired.
//
// Address is offered for every Location method because it's useful
// wayfinding even when not required for verification.

type ExpType = 'location' | 'experience'

function deriveExpType(stop: DesignerStop): ExpType {
  if (stop.experience_type === 'location' || stop.experience_type === 'experience') {
    return stop.experience_type
  }
  // Legacy fallback for rows that pre-date migration 046 backfill:
  // any verification_tier other than 5 implies a physical location.
  if (stop.verification_tier === 5) return 'experience'
  return 'location'
}

function deriveMethod(stop: DesignerStop): LocationMethod {
  const m = stop.experience_verification_method
  if (m === 'gps' || m === 'qr' || m === 'witnessed' || m === 'documented') return m
  // Legacy fallback — map verification_tier back to a method.
  switch (stop.verification_tier) {
    case 1:
    case 2: return 'qr'
    case 3: return 'gps'
    case 4: return 'witnessed'
    default: return 'gps'
  }
}

function LocationSection({
  stop,
  updateStop,
  persist,
}: {
  stop: DesignerStop
  updateStop: (id: string, patch: Partial<DesignerStop>) => void
  persist: (patch: Partial<DesignerStop>) => Promise<void>
}) {
  const expType = deriveExpType(stop)
  const method = expType === 'location' ? deriveMethod(stop) : null
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleTypeChange = (next: ExpType) => {
    if (next === 'experience') {
      // Event/Activity: forced honor. Trigger sets verification_tier=5
      // and experience_verification_method='honor'; we send both for
      // immediate local consistency before the server roundtrip.
      void persist({ experience_type: 'experience', experience_verification_method: 'honor' })
    } else {
      // Location: if no valid method is already set, default to GPS.
      // Preserve any prior method choice when swapping back.
      const prior = stop.experience_verification_method
      const carryMethod =
        prior === 'gps' || prior === 'qr' || prior === 'witnessed' || prior === 'documented'
          ? prior
          : 'gps'
      void persist({ experience_type: 'location', experience_verification_method: carryMethod })
    }
  }

  const handleMethodChange = (next: LocationMethod) => {
    void persist({ experience_verification_method: next })
  }

  const requireAddress = method === 'qr'
  const requireCoords = method === 'gps'

  // Filling the address + coords from a place search.
  // Saves what the picker returned via the existing persist path so
  // the per-mutation debounced write picks them up just like a manual
  // edit. The user can tweak afterwards — autofill is a convenience,
  // not a lock.
  const handlePlaceSelect = (place: ResolvedPlace) => {
    void persist({
      address_street: place.street,
      address_city:   place.city,
      address_state:  place.state,
      address_zip:    place.zip,
      country:        place.country,
      lat:            place.lat,
      lng:            place.lng,
    })
  }

  return (
    <Section title="Location & verification">
      <Field label="Stop type">
        <select
          value={expType}
          onChange={(e) => handleTypeChange(e.target.value as ExpType)}
          className="h-8 w-full rounded-card border border-hairline bg-white px-2 text-sm"
        >
          <option value="location">Location (a place you go)</option>
          <option value="experience">Event / Activity (not physical)</option>
        </select>
      </Field>

      {expType === 'experience' && (
        <p className="text-xs text-muted">
          Self-reported. Visitors confirm completion on the honor system — no address, coordinates, or verification needed.
        </p>
      )}

      {expType === 'location' && method && (
        <>
          {/* Place search — populates address + lat/lng in one shot.
              Renders nothing when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is
              unset; manual fields below + the map picker still work. */}
          <PlaceSearch onSelect={handlePlaceSelect} />

          <Field label="Verification method">
            <select
              value={method}
              onChange={(e) => handleMethodChange(e.target.value as LocationMethod)}
              className="h-8 w-full rounded-card border border-hairline bg-white px-2 text-sm"
            >
              {LOCATION_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {LOCATION_METHODS.find((m) => m.value === method)?.hint}
            </p>
          </Field>

          {/* Address — available for every Location method; required for QR */}
          <Field label={`Street address${requireAddress ? ' *' : ''}`}>
            <Input
              value={stop.address_street ?? ''}
              placeholder="123 Main St"
              onChange={(e) => updateStop(stop.id, { address_street: e.target.value })}
              onBlur={(e) => persist({ address_street: e.target.value })}
              className="h-8 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`City${requireAddress ? ' *' : ''}`}>
              <Input
                value={stop.address_city ?? ''}
                placeholder="Springfield"
                onChange={(e) => updateStop(stop.id, { address_city: e.target.value })}
                onBlur={(e) => persist({ address_city: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="State / Province / Region">
              <Input
                value={stop.address_state ?? ''}
                placeholder="IL / Sinaloa / ..."
                onChange={(e) => updateStop(stop.id, { address_state: e.target.value })}
                onBlur={(e) => persist({ address_state: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Postal / ZIP code">
              <Input
                value={stop.address_zip ?? ''}
                placeholder="62701"
                maxLength={20}
                onChange={(e) => updateStop(stop.id, { address_zip: e.target.value })}
                onBlur={(e) => persist({ address_zip: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Country">
              <Input
                value={stop.country ?? ''}
                placeholder="USA / Mexico / ..."
                onChange={(e) => updateStop(stop.id, { country: e.target.value })}
                onBlur={(e) => persist({ country: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
          </div>

          {/* Coordinates — available for every Location method; required for GPS */}
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Lat${requireCoords ? ' *' : ''}`}>
              <Input
                type="number"
                step="0.000001"
                value={stop.lat ?? ''}
                onChange={(e) =>
                  updateStop(stop.id, { lat: e.target.value ? Number(e.target.value) : null })
                }
                onBlur={(e) =>
                  persist({ lat: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 text-xs"
              />
            </Field>
            <Field label={`Lng${requireCoords ? ' *' : ''}`}>
              <Input
                type="number"
                step="0.000001"
                value={stop.lng ?? ''}
                onChange={(e) =>
                  updateStop(stop.id, { lng: e.target.value ? Number(e.target.value) : null })
                }
                onBlur={(e) =>
                  persist({ lng: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 text-xs"
              />
            </Field>
          </div>

          {MAPS_PICKER_AVAILABLE ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="w-full"
              >
                Pick on map
              </Button>
              <MapPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                initialLat={stop.lat}
                initialLng={stop.lng}
                onConfirm={(lat, lng) => void persist({ lat, lng })}
              />
            </>
          ) : (
            <p className="text-xs text-muted">
              Map picker unavailable — enter coordinates manually.
            </p>
          )}

          {(method === 'gps' || method === 'qr') && (
            <Field label="GPS radius (meters)">
              <Input
                type="number"
                value={stop.verification_radius_meters ?? 150}
                min={10}
                max={5000}
                onChange={(e) =>
                  updateStop(stop.id, { verification_radius_meters: Number(e.target.value) })
                }
                onBlur={(e) => persist({ verification_radius_meters: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </Field>
          )}
        </>
      )}
    </Section>
  )
}

function StopInspector({
  stop,
  creatorInstitutionId,
}: {
  stop: DesignerStop
  creatorInstitutionId: string | null
}) {
  const updateStop = usePassportStore((s) => s.updateStop)
  const removeStop = usePassportStore((s) => s.removeStop)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)

  const persist = async (patch: Partial<DesignerStop>) => {
    updateStop(stop.id, patch)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete stop "${stop.name}"?`)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    await db.from('stops').delete().eq('id', stop.id)
    removeStop(stop.id)
    setSelectedStop(null)
  }

  const handleGenerateQR = async () => {
    // Server-side provisioning: see supabase/functions/provision-qr-token.
    // Math.random was predictable; tokens are now crypto.getRandomValues
    // server-side and stored in stops.qr_code_id (the production column).
    const db = createClient()
    const { data, error } = await db.functions.invoke('provision-qr-token', {
      body: { stopId: stop.id, regenerate: !!stop.qr_code_id },
    })
    const token = (data as { token?: string } | null)?.token
    if (error || !token) {
      console.error('qr-token request failed', error)
      return
    }
    // The function already persisted to the DB; mirror the value locally.
    updateStop(stop.id, { qr_code_id: token })
  }

  return (
    <div className="space-y-5 p-4">
      <Field label="Name">
        <Input
          value={stop.name}
          onChange={(e) => updateStop(stop.id, { name: e.target.value })}
          onBlur={(e) => persist({ name: e.target.value })}
          className="h-8 text-sm"
        />
      </Field>

      <Field label="Rotation (°)">
        <Input
          type="number"
          min={0}
          max={359}
          value={stop.rotation ?? 0}
          onChange={(e) => updateStop(stop.id, { rotation: Number(e.target.value) })}
          onBlur={(e) => persist({ rotation: Number(e.target.value) })}
          className="h-8 text-sm"
        />
      </Field>

      {/* Legacy 5-tier "Verification" radio (T1=Honor … T5=Documented)
          was removed in migration 046's reconciliation. The labels there
          did not match what verify-stamp actually does; the canonical
          Stop type + method controls live in LocationSection above and
          derive verification_tier via DB trigger. */}

      {/* QR token control — only when the canonical method is 'qr'. The
          token is the canonical qr_code_id column; the legacy
          qr_code_token column is not exposed. */}
      {deriveExpType(stop) === 'location' && deriveMethod(stop) === 'qr' && (
        <Section title="QR code">
          <div className="space-y-1.5">
            <Input
              value={stop.qr_code_id ?? ''}
              readOnly
              placeholder="No token yet"
              className="h-8 font-mono text-xs"
            />
            <Button variant="secondary" size="sm" className="w-full" onClick={handleGenerateQR}>
              Generate token
            </Button>
          </div>
        </Section>
      )}

      <Section title="Stamp">
        <StampPicker stop={stop} persist={persist} />

        <Field label="Ink color">
          <div className="flex items-center gap-2">
            <Input
              value={stop.stamp_color ?? '1D9E75'}
              maxLength={6}
              onChange={(e) => updateStop(stop.id, { stamp_color: e.target.value })}
              onBlur={(e) => void persist({ stamp_color: e.target.value })}
              className="h-8 flex-1 font-mono text-sm uppercase"
            />
            <ColorPickerInput
              value={stop.stamp_color ?? '1D9E75'}
              onChange={(hex) => updateStop(stop.id, { stamp_color: hex })}
              onCommit={(hex) => void persist({ stamp_color: hex })}
            />
          </div>
        </Field>

        <div>
          <Label className="text-xs text-muted">Smudge</Label>
          <div className="mt-1.5 flex gap-1">
            {SMUDGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => persist({ smudge_intensity: opt })}
                className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                  stop.smudge_intensity === opt
                    ? 'border-green bg-cream text-green font-medium'
                    : 'border-hairline text-muted hover:border-green/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <LocationSection stop={stop} updateStop={updateStop} persist={persist} />


      {/* The duplicate "Type: Location / Activity" selector that lived
          here is gone — the canonical stop type now lives in the
          Location & Verification section above (migration 046). */}
      <Section title="Learning">
        <Field label="Learning objective">
          <Input
            value={stop.learning_objective ?? ''}
            placeholder="e.g. Identify three bird species"
            onChange={(e) => updateStop(stop.id, { learning_objective: e.target.value })}
            onBlur={(e) => persist({ learning_objective: e.target.value || null })}
            className="h-8 text-sm"
          />
        </Field>
      </Section>

      <Section title="Educational">
        <Field label="Journal prompt">
          <textarea
            value={stop.journal_prompt ?? ''}
            placeholder="What did you observe here? What surprised you?"
            onChange={(e) => updateStop(stop.id, { journal_prompt: e.target.value })}
            onBlur={(e) => persist({ journal_prompt: e.target.value || null })}
            rows={2}
            className="w-full resize-none rounded-panel border border-hairline px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green"
          />
        </Field>
        <Field label="Classifiers">
          <div className="flex flex-wrap gap-1.5">
            {CLASSIFIER_OPTIONS.map(({ value, label }) => {
              const active = (stop.classifiers ?? []).includes(value)
              return (
                <button
                  key={value}
                  onClick={() => {
                    const current: string[] = stop.classifiers ?? []
                    const next: string[] = active
                      ? current.filter((c) => c !== value)
                      : [...current, value]
                    void persist({ classifiers: next })
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    active
                      ? 'border-green bg-cream text-green font-medium'
                      : 'border-hairline text-muted hover:border-green/40'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>
        {(stop.classifiers ?? []).includes('educational') && (
          <>
            <Field label="Grade levels">
              <div className="flex flex-wrap gap-1.5">
                {GRADE_LEVEL_OPTIONS.map(({ value, label }) => {
                  const active = (stop.grade_levels ?? []).includes(value)
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        const current = stop.grade_levels ?? []
                        const next = active
                          ? current.filter((g) => g !== value)
                          : [...current, value]
                        void persist({ grade_levels: next })
                      }}
                      className={`rounded-card border px-2.5 py-0.5 text-xs transition-colors ${
                        active
                          ? 'border-green bg-cream text-green font-medium'
                          : 'border-hairline text-muted hover:border-green/40'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Subject areas">
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_AREA_OPTIONS.map(({ value, label }) => {
                  const active = (stop.subject_areas ?? []).includes(value)
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        const current = stop.subject_areas ?? []
                        const next = active
                          ? current.filter((s) => s !== value)
                          : [...current, value]
                        void persist({ subject_areas: next })
                      }}
                      className={`rounded-card border px-2.5 py-0.5 text-xs transition-colors ${
                        active
                          ? 'border-green bg-cream text-green font-medium'
                          : 'border-hairline text-muted hover:border-green/40'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </>
        )}
      </Section>

      {/* Share with the community — visible when educational classifier is set */}
      {(stop.classifiers ?? []).includes('educational') && (
        <Section title="Share with the community">
          <p className="text-xs text-muted leading-relaxed">
            When shared, other educators can import this stop into their passports.
            Your name and institution will be credited.
          </p>
          <label
            className={`flex items-start gap-3 ${creatorInstitutionId ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <input
              type="checkbox"
              checked={stop.is_shared ?? false}
              disabled={!creatorInstitutionId}
              onChange={(e) => {
                if (!creatorInstitutionId) return
                const shared = e.target.checked
                void persist({
                  is_shared: shared,
                  shared_at: shared ? new Date().toISOString() : null,
                })
              }}
              className="mt-0.5 h-4 w-4 rounded accent-green"
            />
            <span className="text-sm text-navy">Share this stop</span>
          </label>
          {!creatorInstitutionId && (
            <p className="text-xs text-muted leading-relaxed">
              Educational stops can only be shared by verified institutional accounts.
            </p>
          )}
        </Section>
      )}

      <div className="border-t border-hairline pt-4">
        <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
          Delete stop
        </Button>
      </div>
    </div>
  )
}

// ── Custom background image picker ────────────────────────────────────────────

interface BgAsset { id: string; url: string | null; name: string | null }

function CustomBgPicker({
  page,
  persist,
}: {
  page: DesignerPassportPage
  persist: (patch: Partial<DesignerPassportPage>) => Promise<void>
}) {
  const [assets, setAssets] = useState<BgAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void (async () => {
      const { data } = await db
        .from('design_assets')
        .select('id, url, name')
        .eq('asset_type', 'background')
        .order('created_at', { ascending: false })
      setAssets((data ?? []) as BgAsset[])
      setLoading(false)
    })()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${user.id}/bg-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('design-assets').upload(path, file)
      if (upErr) {
        usePassportStore.getState().setSaveError(`Upload failed: ${upErr.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('design-assets').getPublicUrl(path)
      const asset = await safeInsert<BgAsset>(
        'design_assets',
        { asset_type: 'background', url: publicUrl, storage_path: path, name: file.name, owner_id: user.id },
        'id, url, name',
      )
      if (asset) {
        setAssets((prev) => [asset, ...prev])
        await persist({ background_image_url: asset.url })
      }
      // If asset is null, safeInsert already surfaced the error via store.
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted">Background image</Label>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-xs text-muted">No backgrounds uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative">
              <button
                onClick={() => void persist({ background_image_url: asset.url })}
                className={`relative aspect-video w-full overflow-hidden rounded border-2 transition-colors ${
                  page.background_image_url === asset.url
                    ? 'border-green'
                    : 'border-transparent hover:border-green/40'
                }`}
                title={asset.name ?? ''}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url ?? ''} alt={asset.name ?? ''} className="h-full w-full object-cover" />
              </button>
              <AssetDeleteButton
                assetId={asset.id}
                assetName={asset.name ?? 'Untitled'}
                onDeleted={() => setAssets((prev) => prev.filter((a) => a.id !== asset.id))}
              />
            </div>
          ))}
        </div>
      )}
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border border-hairline px-3 py-2 text-xs transition-colors ${
          uploading ? 'pointer-events-none opacity-50' : 'text-muted hover:border-green/40'
        }`}
      >
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? 'Uploading…' : '+ Upload background'}
      </label>
    </div>
  )
}

// ── Page Inspector ─────────────────────────────────────────────────────────────

function PageInspector({ page }: { page: DesignerPassportPage }) {
  const updatePage = usePassportStore((s) => s.updatePage)

  const persist = async (patch: Partial<DesignerPassportPage>) => {
    updatePage(page.id, patch)
  }

  const bg = page.background_type

  return (
    <div className="space-y-5 p-4">
      {page.page_type === 'information' && (
        <div className="rounded-card bg-cream px-3 py-2 text-xs text-green">
          📄 Information page — no stamps collected here
        </div>
      )}
      <Section title="Section">
        <Field label="Title">
          <Input
            value={page.section_title ?? ''}
            placeholder="e.g. Downtown Historic District"
            onChange={(e) => updatePage(page.id, { section_title: e.target.value })}
            onBlur={(e) => persist({ section_title: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Subtitle">
          <Input
            value={page.section_subtitle ?? ''}
            placeholder="Optional tagline"
            onChange={(e) => updatePage(page.id, { section_subtitle: e.target.value })}
            onBlur={(e) => persist({ section_subtitle: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
      </Section>

      <Section title="Background">
        <Field label="Type">
          <select
            value={bg}
            onChange={(e) => void persist({ background_type: e.target.value as BackgroundType })}
            className="h-8 w-full rounded-panel border border-hairline bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
          >
            <option value="guilloche">Guilloche</option>
            <option value="grid">Grid</option>
            <option value="none">None</option>
            <option value="custom">Custom image</option>
            {bg === 'landscape' && <option value="landscape">Landscape (legacy)</option>}
          </select>
        </Field>

        <Field label="Paper color">
          <div className="flex gap-2">
            <Input
              value={page.paper_color ?? 'F5F2EC'}
              maxLength={6}
              onChange={(e) => updatePage(page.id, { paper_color: e.target.value })}
              onBlur={(e) => persist({ paper_color: e.target.value })}
              className="h-8 flex-1 font-mono text-sm uppercase"
            />
            <ColorPickerInput
              value={page.paper_color ?? 'F5F2EC'}
              onChange={(hex) => updatePage(page.id, { paper_color: hex })}
              onCommit={(hex) => void persist({ paper_color: hex })}
            />
          </div>
        </Field>

        {(bg === 'guilloche' || bg === 'grid') && (
          <Field label="Pattern color">
            <div className="flex gap-2">
              <Input
                value={page.background_color ?? '0D1B2A'}
                maxLength={6}
                onChange={(e) => updatePage(page.id, { background_color: e.target.value })}
                onBlur={(e) => persist({ background_color: e.target.value })}
                className="h-8 flex-1 font-mono text-sm uppercase"
              />
              <ColorPickerInput
                value={page.background_color ?? '0D1B2A'}
                onChange={(hex) => updatePage(page.id, { background_color: hex })}
                onCommit={(hex) => void persist({ background_color: hex })}
              />
            </div>
          </Field>
        )}

        {/* Pattern opacity — only for guilloche/grid */}
        {(bg === 'guilloche' || bg === 'grid') && (
          <Field label={`Opacity: ${Math.min(100, Math.max(10, page.background_opacity ?? 100))}%`}>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={Math.min(100, Math.max(10, page.background_opacity ?? 100))}
              onChange={(e) =>
                updatePage(page.id, { background_opacity: Number(e.target.value) })
              }
              onMouseUp={(e) =>
                persist({
                  background_opacity: Number((e.target as HTMLInputElement).value),
                })
              }
              className="w-full accent-green"
            />
            <p className="text-xs text-muted">10–100%. Keep low for stamp legibility.</p>
          </Field>
        )}

        {/* Custom image controls */}
        {bg === 'custom' && (
          <>
            <Field label={`Image opacity: ${Math.min(100, Math.max(10, page.custom_background_opacity ?? 100))}%`}>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={Math.min(100, Math.max(10, page.custom_background_opacity ?? 100))}
                onChange={(e) =>
                  updatePage(page.id, { custom_background_opacity: Number(e.target.value) })
                }
                onMouseUp={(e) =>
                  persist({ custom_background_opacity: Number((e.target as HTMLInputElement).value) })
                }
                className="w-full accent-green"
              />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(page.custom_background_opacity ?? 100) >= 100}
                onChange={(e) => {
                  const val = e.target.checked ? 100 : 10
                  updatePage(page.id, { custom_background_opacity: val })
                  void persist({ custom_background_opacity: val })
                }}
                className="h-4 w-4 rounded accent-green"
              />
              <span className="text-sm text-navy">Full color background</span>
            </label>
            <CustomBgPicker page={page} persist={persist} />
          </>
        )}
      </Section>

      <Section title="Prize">
        <Field label="Prize description">
          <Input
            value={page.prize_description ?? ''}
            placeholder="Complete all stops to unlock…"
            onChange={(e) => updatePage(page.id, { prize_description: e.target.value })}
            onBlur={(e) => persist({ prize_description: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Location constraint">
          <Input
            value={page.prize_location_constraint ?? ''}
            placeholder="Redeem at front desk"
            onChange={(e) =>
              updatePage(page.id, { prize_location_constraint: e.target.value })
            }
            onBlur={(e) => persist({ prize_location_constraint: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
      </Section>
    </div>
  )
}

// ── Passport Inspector ─────────────────────────────────────────────────────────

const PASSPORT_TYPES: { value: PassportType; label: string; hint: string }[] = [
  { value: 'location',   label: 'Adventure',   hint: 'Visit physical places and landmarks' },
  { value: 'experience', label: 'Challenge',    hint: 'Complete activities or experiences' },
  { value: 'learning',   label: 'Educational',  hint: 'Learn and discover along the way' },
]

function PassportInspector() {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  if (!passport) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  const persist = async (patch: Parameters<typeof updatePassport>[0]) => {
    updatePassport(patch)
  }

  return (
    <div className="space-y-5 p-4">
      <Section title="Passport">
        <Field label="Title">
          <Input
            value={passport.title}
            onChange={(e) => updatePassport({ title: e.target.value })}
            onBlur={(e) => persist({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={passport.description ?? ''}
            placeholder="What is this passport about?"
            onChange={(e) => updatePassport({ description: e.target.value })}
            onBlur={(e) => persist({ description: e.target.value || null })}
            rows={3}
            className="w-full rounded-panel border border-hairline bg-white px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green resize-none"
          />
        </Field>
      </Section>

      <Section title="Type">
        <div className="space-y-1.5">
          {PASSPORT_TYPES.map(({ value, label, hint }) => (
            <button
              key={value}
              onClick={() => persist({ passport_type: value })}
              className={`w-full rounded-card border px-3 py-2 text-left transition-colors ${
                passport.passport_type === value
                  ? 'border-green bg-cream'
                  : 'border-hairline hover:border-green/40'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  passport.passport_type === value ? 'text-green' : 'text-navy'
                }`}
              >
                {label}
              </p>
              <p className="mt-0.5 text-xs text-muted">{hint}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accessibility">
        {(['transit_accessible', 'wheelchair_accessible'] as const).map((field) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={passport[field] ?? false}
              onChange={(e) => persist({ [field]: e.target.checked } as Partial<typeof passport>)}
              className="accent-green"
            />
            <span className="text-sm text-navy capitalize">
              {field === 'transit_accessible' ? 'Transit accessible' : 'Wheelchair accessible'}
            </span>
          </label>
        ))}
      </Section>
    </div>
  )
}

// ── Image element picker ───────────────────────────────────────────────────────
//
// Lists previously-uploaded images for the current user so a creator can
// reuse an image across pages without re-uploading. Uploads also write a
// design_assets row (asset_type='image') so the library accumulates.

interface ImageAsset { id: string; url: string; name: string | null }

function ImageElementPicker({
  element,
  persist,
}: {
  element: ImagePageElement
  persist: (patch: Partial<ImagePageElement>) => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState<ImageAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void (async () => {
      const { data: { user } } = await (db as ReturnType<typeof createClient>).auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await db
        .from('design_assets')
        .select('id, url, name')
        .eq('asset_type', 'image')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setAssets((data ?? []) as ImageAsset[])
      setLoading(false)
    })()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${user.id}/img-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('design-assets').upload(path, file)
      if (upErr) {
        usePassportStore.getState().setSaveError(`Upload failed: ${upErr.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('design-assets').getPublicUrl(path)
      // Record the asset so future image elements can pick it without re-upload.
      const asset = await safeInsert<ImageAsset>(
        'design_assets',
        { asset_type: 'image', url: publicUrl, storage_path: path, name: file.name, owner_id: user.id },
        'id, url, name',
      )
      if (asset) setAssets((prev) => [asset, ...prev])
      await persist({ imageUrl: publicUrl })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {element.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.imageUrl}
          alt=""
          className="w-full rounded border border-hairline object-cover"
          style={{ maxHeight: 120 }}
        />
      )}

      {!loading && assets.length > 0 && (
        <div>
          <Label className="text-xs text-muted">Your uploaded images</Label>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {assets.map((asset) => (
              <div key={asset.id} className="group relative">
                <button
                  type="button"
                  onClick={() => void persist({ imageUrl: asset.url })}
                  title={asset.name ?? ''}
                  className={`relative aspect-square w-full overflow-hidden rounded-card border transition-colors ${
                    element.imageUrl === asset.url
                      ? 'border-green ring-1 ring-green'
                      : 'border-hairline hover:border-green/40'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt={asset.name ?? ''} className="h-full w-full object-cover" />
                </button>
                <AssetDeleteButton
                  assetId={asset.id}
                  assetName={asset.name ?? 'Untitled'}
                  onDeleted={() => setAssets((prev) => prev.filter((a) => a.id !== asset.id))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border border-hairline px-3 py-2 text-xs transition-colors ${
          uploading ? 'pointer-events-none opacity-50' : 'text-muted hover:border-green/40'
        }`}
      >
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? 'Uploading…' : '+ Upload image'}
      </label>
    </div>
  )
}

// ── Element Inspector ──────────────────────────────────────────────────────────

const LABEL_COLORS = ['0D1B2A', '1D9E75', 'C9A84C', 'D85A30', '7F77DD', '888888']

const FONT_OPTIONS = [
  { value: 'Arial, sans-serif',                label: 'Arial' },
  { value: 'var(--font-inter), sans-serif',    label: 'Inter' },
  { value: 'Georgia, serif',                   label: 'Georgia' },
  { value: 'var(--font-playfair), serif',      label: 'Playfair Display' },
  { value: 'var(--font-lora), serif',          label: 'Lora' },
  { value: 'var(--font-bebas), sans-serif',    label: 'Bebas Neue' },
  { value: 'var(--font-abril), serif',         label: 'Abril Fatface' },
] as const

function ElementInspector({
  element,
  pageId,
}: {
  element: DesignerPageElement
  pageId: string
}) {
  const updateElement = usePassportStore((s) => s.updateElement)
  const removeElement = usePassportStore((s) => s.removeElement)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)

  const persist = async (patch: Partial<DesignerPageElement>) => {
    updateElement(pageId, element.id, patch)
  }

  const handleDelete = async () => {
    removeElement(pageId, element.id)
    setSelectedElement(null)
  }

  return (
    <div className="space-y-5 p-4">
      {element.type === 'image' && (
        <Section title="Image">
          <ImageElementPicker
            element={element as ImagePageElement}
            persist={(patch) => persist(patch as Partial<DesignerPageElement>)}
          />
          <Field label={`Opacity: ${(element as ImagePageElement).opacity ?? 100}%`}>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={(element as ImagePageElement).opacity ?? 100}
              onChange={(e) =>
                updateElement(pageId, element.id, { opacity: Number(e.target.value) } as Partial<DesignerPageElement>)
              }
              onMouseUp={(e) =>
                void persist({ opacity: Number((e.target as HTMLInputElement).value) } as Partial<DesignerPageElement>)
              }
              className="w-full accent-green"
            />
          </Field>
        </Section>
      )}

      {element.type === 'text' && (
        <Section title="Text">
          <Field label="Content">
            <textarea
              value={element.content ?? ''}
              placeholder="Section header…"
              rows={3}
              onChange={(e) => updateElement(pageId, element.id, { content: e.target.value })}
              onBlur={(e) => persist({ content: e.target.value })}
              className="w-full resize-y rounded-panel border border-hairline bg-paper px-3 py-1.5 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size (px)">
              <Input
                type="number"
                min={8}
                max={72}
                value={element.fontSize ?? 14}
                onChange={(e) =>
                  updateElement(pageId, element.id, { fontSize: Number(e.target.value) })
                }
                onBlur={(e) => persist({ fontSize: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Weight">
              <select
                value={element.fontWeight ?? 'normal'}
                onChange={(e) =>
                  persist({ fontWeight: e.target.value as 'normal' | 'bold' })
                }
                className="h-8 w-full rounded-panel border border-hairline px-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </Field>
          </div>
          <Field label="Align">
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => persist({ align: a })}
                  className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                    (element.align ?? 'left') === a
                      ? 'border-green bg-cream text-green font-medium'
                      : 'border-hairline text-muted hover:border-green/40'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Font">
            <select
              value={element.fontFamily ?? 'Arial, sans-serif'}
              onChange={(e) => persist({ fontFamily: e.target.value })}
              className="h-8 w-full rounded-panel border border-hairline px-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
            {/* Live preview */}
            <p
              className="mt-1.5 truncate text-sm text-navy"
              style={{ fontFamily: element.fontFamily ?? 'Arial, sans-serif' }}
            >
              The quick brown fox
            </p>
          </Field>
          <Field label="Color">
            <div className="flex gap-2">
              <Input
                value={element.color ?? '0D1B2A'}
                maxLength={6}
                onChange={(e) => updateElement(pageId, element.id, { color: e.target.value })}
                onBlur={(e) => void persist({ color: e.target.value })}
                className="h-8 flex-1 font-mono text-sm uppercase"
              />
              <ColorPickerInput
                value={element.color ?? '0D1B2A'}
                onChange={(hex) => updateElement(pageId, element.id, { color: hex })}
                onCommit={(hex) => void persist({ color: hex })}
              />
            </div>
          </Field>
        </Section>
      )}

      {(element.type === 'line' || element.type === 'hline' || element.type === 'vline') && (
        <Section title="Line">
          <Field label="Thickness (px)">
            <Input
              type="number"
              min={1}
              max={20}
              value={(element as LinePageElement).thickness ?? (element as any).thickness ?? 2}
              onChange={(e) =>
                updateElement(pageId, element.id, { thickness: Number(e.target.value) } as Partial<DesignerPageElement>)
              }
              onBlur={(e) => persist({ thickness: Number(e.target.value) } as Partial<DesignerPageElement>)}
              className="h-8 text-sm"
            />
          </Field>
          <Field label="Color">
            <div className="flex gap-2">
              <Input
                value={(element as LinePageElement).lineColor ?? (element as any).lineColor ?? '0D1B2A'}
                maxLength={6}
                onChange={(e) => updateElement(pageId, element.id, { lineColor: e.target.value } as Partial<DesignerPageElement>)}
                onBlur={(e) => void persist({ lineColor: e.target.value } as Partial<DesignerPageElement>)}
                className="h-8 flex-1 font-mono text-sm uppercase"
              />
              <ColorPickerInput
                value={(element as LinePageElement).lineColor ?? (element as any).lineColor ?? '0D1B2A'}
                onChange={(hex) => updateElement(pageId, element.id, { lineColor: hex } as Partial<DesignerPageElement>)}
                onCommit={(hex) => void persist({ lineColor: hex } as Partial<DesignerPageElement>)}
              />
            </div>
          </Field>
        </Section>
      )}

      <Section title="Position">
        {element.type === 'line' ? (
          <div className="grid grid-cols-2 gap-2">
            {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
              <Field key={key} label={key.toUpperCase()}>
                <Input
                  type="number"
                  value={Math.round((element as LinePageElement)[key])}
                  onChange={(e) =>
                    updateElement(pageId, element.id, { [key]: Number(e.target.value) } as Partial<DesignerPageElement>)
                  }
                  onBlur={(e) => persist({ [key]: Number(e.target.value) } as Partial<DesignerPageElement>)}
                  className="h-8 text-sm"
                />
              </Field>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map((key) => (
              <Field key={key} label={key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase()}>
                <Input
                  type="number"
                  value={Math.round((element as any)[key])}
                  onChange={(e) =>
                    updateElement(pageId, element.id, { [key]: Number(e.target.value) } as Partial<DesignerPageElement>)
                  }
                  onBlur={(e) => persist({ [key]: Number(e.target.value) } as Partial<DesignerPageElement>)}
                  className="h-8 text-sm"
                />
              </Field>
            ))}
          </div>
        )}

        {/* Rotation — text and image only */}
        {(element.type === 'text' || element.type === 'image') && (
          <Field label="Rotation (°)">
            <Input
              type="number"
              min={0}
              max={359}
              value={(element as TextPageElement | ImagePageElement).rotation ?? 0}
              onChange={(e) =>
                updateElement(pageId, element.id, { rotation: Number(e.target.value) } as Partial<DesignerPageElement>)
              }
              onBlur={(e) => persist({ rotation: Number(e.target.value) } as Partial<DesignerPageElement>)}
              className="h-8 text-sm"
            />
          </Field>
        )}
      </Section>

      <div className="border-t border-hairline pt-4">
        <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
          Delete element
        </Button>
      </div>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted">{label}</Label>
      {children}
    </div>
  )
}
