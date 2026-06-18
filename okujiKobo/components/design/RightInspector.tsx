'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  usePassportStore,
  selectActivePage,
  selectSelectedStop,
  selectSelectedStopPage,
  selectSelectedPunch,
  selectSelectedElement,
} from '@/lib/design/passport-store'
import { CLASSIFIERS } from '@/lib/design/classifiers'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Button } from './ui/Button'
import { ColorPickerInput } from './ui/ColorPickerInput'
import { MapPickerDialog, MAPS_PICKER_AVAILABLE } from './MapPickerDialog'
import { AssetDeleteButton } from './AssetDeleteButton'
import { Collapsible } from './Collapsible'
import { safeUpdate, safeInsert } from '@/lib/design/persist'
import { cn } from '@/lib/cn'
import { usePersistentBool } from './usePersistent'
import type {
  DesignerStop,
  DesignerPunch,
  DesignerPassportPage,
  BackgroundType,
  DesignerPageElement,
  PassportType,
  ImagePageElement,
  LayoutPageElement,
  TextPageElement,
  RichTextPageElement,
  TextRun,
  LinePageElement,
} from '@/lib/design/types'
import { domToRuns, runsToHtml, stopAddressToRuns } from '@/lib/design/rich-text'
import type { StampAsset } from '@/lib/design/stamp-assets'
import { StampComposer } from './StampComposer'
import { composeAddressLine, formatCoordinates } from '@/lib/design/location-caption'

export function RightInspector({
  creatorInstitutionId,
  width,
}: {
  creatorInstitutionId: string | null
  width?: number
}) {
  const activePage = usePassportStore(selectActivePage)
  const selectedStop = usePassportStore(selectSelectedStop)
  // The page the selected STOP belongs to — not the active tab. The
  // previous guard checked activePage.page_type, which hid this panel
  // (and its Stop type / verification-method controls from migration
  // 046) whenever the user happened to be on an information tab, even
  // for a stop that lives on a stamp page.
  const selectedStopPage = usePassportStore(selectSelectedStopPage)
  const selectedPunch = usePassportStore(selectSelectedPunch)
  const selectedElement = usePassportStore(selectSelectedElement)

  const label = selectedPunch
    ? 'Punch'
    : selectedStop
    ? 'Stop'
    : selectedElement
    ? selectedElement.type === 'text'  ? 'Label'
      : selectedElement.type === 'image' ? 'Image'
      : selectedElement.type === 'layout' ? 'Layout'
      : selectedElement.type === 'line'  ? 'Line'
      : selectedElement.type === 'hline' ? 'H-Line'
      : 'V-Line'
    : activePage
    ? 'Page'
    : 'Passport'

  const title = selectedPunch
    ? (selectedPunch.label || 'Punch slot')
    : selectedStop
    ? selectedStop.name
    : selectedElement
    ? selectedElement.type === 'text'  ? (selectedElement.content ?? '—')
      : selectedElement.type === 'image' ? 'Image element'
      : selectedElement.type === 'layout' ? 'Layout element'
      : selectedElement.type === 'line'  ? 'Line'
      : selectedElement.type === 'hline' ? 'H-Line'
      : 'V-Line'
    : activePage
    ? activePage.section_title ?? activePage.section_name
    : 'No selection'

  return (
    <aside
      className={cn('flex shrink-0 flex-col border-l border-hairline bg-surface-workspace', width == null && 'w-[280px]')}
      style={width != null ? { width } : undefined}
    >
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-navy">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedPunch ? (
          <PunchInspector punch={selectedPunch} />
        ) : selectedStop && selectedStopPage?.page_type !== 'information' ? (
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

// ── Punch inspector (moichido) ────────────────────────────────────────────────
// Deliberately tiny: a punch is a boolean increment, so the only authorable
// fields are its optional label and its position/size on the card. No
// location, verification, stamp, or education controls.
function PunchInspector({ punch }: { punch: DesignerPunch }) {
  const updatePunch = usePassportStore((s) => s.updatePunch)
  const removePunch = usePassportStore((s) => s.removePunch)

  const handleDelete = async () => {
    if (!window.confirm('Delete this punch slot?')) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const { error } = await db.from('punch_slots').delete().eq('id', punch.id)
    if (error) { window.alert(error.message ?? 'Delete failed'); return }
    removePunch(punch.id)
  }

  const num = (v: string, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label>Label (optional)</Label>
        <Input
          value={punch.label ?? ''}
          placeholder="e.g. Free coffee"
          onChange={(e) => updatePunch(punch.id, { label: e.target.value || null })}
        />
        <p className="mt-1 text-xs text-muted">
          Shown beneath the punch — handy for the reward slot.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>X</Label>
          <Input type="number" value={Math.round(punch.box_x)} onChange={(e) => updatePunch(punch.id, { box_x: num(e.target.value, punch.box_x) })} />
        </div>
        <div>
          <Label>Y</Label>
          <Input type="number" value={Math.round(punch.box_y)} onChange={(e) => updatePunch(punch.id, { box_y: num(e.target.value, punch.box_y) })} />
        </div>
        <div>
          <Label>Width</Label>
          <Input type="number" value={Math.round(punch.box_width)} onChange={(e) => updatePunch(punch.id, { box_width: num(e.target.value, punch.box_width) })} />
        </div>
        <div>
          <Label>Height</Label>
          <Input type="number" value={Math.round(punch.box_height)} onChange={(e) => updatePunch(punch.id, { box_height: num(e.target.value, punch.box_height) })} />
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-full text-xs text-red hover:bg-red/5" onClick={handleDelete}>
        Delete punch slot
      </Button>
    </div>
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

const CAPTION_MODE_OPTIONS = ['off', 'address', 'coordinates'] as const
const CAPTION_PLACEMENT_OPTIONS = ['interior', 'exterior'] as const

// ── StampPicker ────────────────────────────────────────────────────────────────

function StampPicker({
  stop,
  persist,
}: {
  stop: DesignerStop
  persist: (patch: Partial<DesignerStop>) => Promise<void>
}) {
  const currentPassportId = usePassportStore((s) => s.passport?.id ?? null)
  const [myAssets, setMyAssets] = useState<StampAsset[]>([])
  const [instAssets, setInstAssets] = useState<StampAsset[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  // Force-refresh the asset list after the composer saves OR an
  // upload completes.
  const [reloadKey, setReloadKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''  // reset so picking the same file twice still fires
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      // Goes through the SAME /api/assets/upload route the
      // Assets-tab dropper uses — monochrome detection, dim
      // capture, ownership scoping all share one path. We pin
      // scoped_passport_id to the current passport (matching the
      // Custom-background and StampComposer defaults) — users
      // who want library scope upload from the Assets → Stamps
      // tab instead.
      const form = new FormData()
      form.append('file', file)
      form.append('asset_type', 'stamp')
      form.append('name', file.name)
      if (currentPassportId) form.append('scoped_passport_id', currentPassportId)
      const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setUploadError(body.error ?? body.message ?? 'Upload failed')
        return
      }
      const json = await res.json() as { id: string; url: string | null }
      // Auto-select the new stamp on the current stop and bump
      // reloadKey so the asset rosters re-fetch + the upload
      // shows up under "My uploads".
      void persist({ stamp_asset_id: json.id, stamp_type: 'custom_asset', stamp_icon: '' })
      setReloadKey((k) => k + 1)
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    void (async () => {
      const { data: { user } } = await (db as ReturnType<typeof createClient>).auth.getUser()
      if (!user) return

      // Library-wide stamps + stamps scoped to the current passport.
      let q = db
        .from('design_assets')
        .select('id, name, url, thumbnail_data, file_format, is_monochrome, institution_id, owner_id, scoped_passport_id')
        .eq('asset_type', 'stamp')
        .neq('is_built_in', true)
      q = currentPassportId
        ? q.or(`scoped_passport_id.is.null,scoped_passport_id.eq.${currentPassportId}`)
        : q.is('scoped_passport_id', null)
      const { data } = await q.order('created_at', { ascending: false })

      const rows = (data ?? []) as StampAsset[]
      setMyAssets(rows.filter((r) => r.owner_id === user.id))
      setInstAssets(rows.filter((r) => r.owner_id !== user.id))
    })()
  }, [currentPassportId, reloadKey])

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
      {/* Compose-a-stamp launcher — primary affordance at the top
          of the picker. Opens the StampComposer modal without
          leaving the passport edit. On save, the new asset id is
          selected on the current stop and the list reloads. */}
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-green/60 bg-cream px-2 py-2 text-xs font-semibold text-green hover:border-green hover:bg-green/10"
      >
        ✎ Create a stamp
      </button>

      {/* Direct-upload alternative — same look, different path.
          Posts the file through /api/assets/upload (the same
          route AssetsClient uses) with asset_type=stamp and
          scoped_passport_id pinned to the current passport so
          the upload lands in this passport's StampPicker by
          default. Reuses the picker reload key so the new
          asset shows up under "My uploads" immediately. */}
      <button
        type="button"
        onClick={() => uploadInputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-green/60 bg-cream px-2 py-2 text-xs font-semibold text-green hover:border-green hover:bg-green/10 disabled:opacity-60"
      >
        {uploading ? 'Uploading…' : '↑ Upload a stamp'}
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      {uploadError && (
        <p role="alert" className="text-[10.5px] text-accent">
          {uploadError}
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="ml-1 underline"
          >
            dismiss
          </button>
        </p>
      )}

      {currentPassportId && (
        <StampComposer
          mode="designer"
          open={composerOpen}
          currentPassportId={currentPassportId}
          onClose={() => setComposerOpen(false)}
          onSaved={(asset) => {
            void persist({ stamp_asset_id: asset.id, stamp_type: 'custom_asset', stamp_icon: '' })
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      {/* My uploads — collapsible (default closed). */}
      {(myAssets.length > 0 || instAssets.length > 0) && (
        <Collapsible title="Uploaded stamps">
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
        </Collapsible>
      )}

      {/* Built-in stamps — collapsible (default closed). */}
      <Collapsible title="Built-in stamps">
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
      </Collapsible>
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
      // immediate local consistency before the server roundtrip. Also clear
      // qr_code_id — an event is honor-based and never QR-verified, so any
      // previously-provisioned token is stale (and must not linger in the
      // QR-sheet generator).
      void persist({ experience_type: 'experience', experience_verification_method: 'honor', qr_code_id: null })
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
          {/* Address + coordinates are set by the map picker below (drop a
              pin → server-side reverse geocode fills the address) or by hand.
              The Places Autocomplete search was removed to avoid the billable
              client Places SKU — geocoding is Geocoding-API-only, server-side. */}

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

          {/* Address & coordinates — collapsible (default closed). */}
          <Collapsible title="Address & coordinates">
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
                onConfirm={(lat, lng, place) =>
                  void persist({
                    lat,
                    lng,
                    // Address autofills from the server-side reverse geocode
                    // when available; coords-only when it isn't (manual entry).
                    ...(place
                      ? {
                          address_street: place.street,
                          address_city: place.city,
                          address_state: place.state,
                          address_zip: place.zip,
                          country: place.country,
                        }
                      : {}),
                  })
                }
              />
            </>
          ) : (
            <p className="text-xs text-muted">
              Map picker unavailable — enter coordinates manually.
            </p>
          )}
          </Collapsible>

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

      {/* Location caption — optional small line on the LocationBox.
          Default off. 'address' composes a single line from the address
          fields above; 'coordinates' shows lat/lng. The earned stamp
          always prints ON TOP of the caption. */}
      <div className="border-t border-hairline pt-3">
        <Label className="text-xs text-muted">Location caption</Label>
        <div className="mt-1.5 flex gap-1">
          {CAPTION_MODE_OPTIONS.map((mode) => (
            <button
              key={mode}
              onClick={() => persist({ location_caption_mode: mode })}
              className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                (stop.location_caption_mode ?? 'off') === mode
                  ? 'border-green bg-cream text-green font-medium'
                  : 'border-hairline text-muted hover:border-green/40'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {(stop.location_caption_mode ?? 'off') !== 'off' && (
          <>
            {/* Live preview of the exact text the renderers will show. */}
            {(() => {
              const preview =
                stop.location_caption_mode === 'coordinates'
                  ? formatCoordinates(stop.lat, stop.lng)
                  : composeAddressLine(stop)
              return preview ? (
                <p className="mt-2 truncate text-xs text-navy">{preview}</p>
              ) : (
                <p className="mt-2 text-xs text-accent">
                  {stop.location_caption_mode === 'coordinates'
                    ? 'No coordinates set — add lat/lng above to show this caption.'
                    : 'No address set — fill the address fields above to show this caption.'}
                </p>
              )
            })()}

            <Label className="mt-3 block text-xs text-muted">Placement</Label>
            <div className="mt-1.5 flex gap-1">
              {CAPTION_PLACEMENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => persist({ location_caption_placement: p })}
                  className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                    (stop.location_caption_placement ?? 'interior') === p
                      ? 'border-green bg-cream text-green font-medium'
                      : 'border-hairline text-muted hover:border-green/40'
                  }`}
                >
                  {p === 'interior' ? 'Interior' : 'Exterior'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
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
  // Consumable passports / moichido cards don't carry the passport-
  // world stop concerns: no verification tier (vendor-presented token
  // is the proof), no per-stop stamp picker (shape is card-level),
  // no learning/educational/share semantics. Hide those sections;
  // name + rotation stay so the merchant can still label a punch
  // location and rotate the box.
  const isConsumable = usePassportStore((s) => s.passport?.credential_type === 'consumable')

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

      {!isConsumable && <Section title="Stamp">
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

        {/* Smudge control removed: the hand-stamped smudge is now imparted
            entirely by the collector's press gesture in the mobile app
            (per-instance smudge_dx/dy/intensity on the stamp), not a
            creator-set per-stop level. The stops.smudge_intensity column is
            left in place (additive discipline); it is simply no longer
            edited here. */}
      </Section>}

      {!isConsumable && <LocationSection stop={stop} updateStop={updateStop} persist={persist} />}


      {/* The duplicate "Type: Location / Activity" selector that lived
          here is gone — the canonical stop type now lives in the
          Location & Verification section above (migration 046). */}
      {!isConsumable && <>
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
      </>}

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
  const currentPassportId = usePassportStore((s) => s.passport?.id ?? null)
  const [assets, setAssets] = useState<BgAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  // Designer uploads default to scoped (this-passport-only). Opt-in
  // checkbox below the upload promotes the next upload to library-wide.
  const [uploadToLibrary, setUploadToLibrary] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void (async () => {
      // Library-wide assets + assets scoped to the current passport.
      // Assets scoped to OTHER passports do not appear in this picker.
      let q = db
        .from('design_assets')
        .select('id, url, name, scoped_passport_id')
        .eq('asset_type', 'background')
      q = currentPassportId
        ? q.or(`scoped_passport_id.is.null,scoped_passport_id.eq.${currentPassportId}`)
        : q.is('scoped_passport_id', null)
      const { data } = await q.order('created_at', { ascending: false })
      setAssets((data ?? []) as BgAsset[])
      setLoading(false)
    })()
  }, [currentPassportId])

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
        {
          asset_type:         'background',
          url:                publicUrl,
          storage_path:       path,
          name:               file.name,
          owner_id:           user.id,
          scoped_passport_id: uploadToLibrary ? null : currentPassportId,
        },
        'id, url, name, scoped_passport_id',
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

  // The okuji presets used to live here; they're now under the
  // dedicated "Okuji preset" background_type (migration 055 +
  // OkujiPresetPicker below). Custom is now uploads + library
  // only.
  return (
    <div className="space-y-2">
      {/* Page background uploads — collapsible (default closed). */}
      <Collapsible title="Your uploads">
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
      </Collapsible>
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border border-hairline px-3 py-2 text-xs transition-colors ${
          uploading ? 'pointer-events-none opacity-50' : 'text-muted hover:border-green/40'
        }`}
      >
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? 'Uploading…' : '+ Upload background'}
      </label>
      <UploadScopeToggle
        checked={uploadToLibrary}
        onChange={setUploadToLibrary}
        disabled={uploading || !currentPassportId}
      />
    </div>
  )
}

// Small opt-in checkbox shown beneath designer uploads. Default
// (unchecked) keeps the next upload scoped to the current passport;
// checked promotes it to the user's library so it shows in every
// passport's picker. Disabled when there's no current passport
// context (defensive — shouldn't happen inside the inspector but
// keeps the prop boundary honest).
function UploadScopeToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-center gap-2 text-xs ${disabled ? 'text-hairline cursor-not-allowed' : 'text-muted cursor-pointer hover:text-navy'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 rounded accent-green"
      />
      <span>Also save to my general library</span>
    </label>
  )
}

// ── Okuji preset picker ────────────────────────────────────────────────────────
//
// First-class entry point for the built-in PRESET_BACKGROUNDS,
// surfaced as its own option in the Page Inspector's background
// "Type" dropdown so creators don't have to dig under "Custom
// image" to find them. Writes to the same background_image_url
// column as custom uploads, and PageBackground renders 'okuji'
// the same way it renders 'custom' (an image overlay).
function OkujiPresetPicker({
  page,
  persist,
}: {
  page: DesignerPassportPage
  persist: (patch: Partial<DesignerPassportPage>) => Promise<void>
}) {
  // Built-in preset grounds now live in design_assets (is_built_in,
  // owned by the custodial account; seeded via scripts/seed-okuji-presets).
  // Readable by any authenticated user via the design_assets read policy,
  // so a plain client query works. Managed from the Assets library's
  // platform-owner account switcher — no redeploy to add/retire one.
  const [presets, setPresets] = useState<{ id: string; url: string; label: string }[]>([])
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void db
      .from('design_assets')
      .select('id, name, display_name, url')
      .eq('asset_type', 'background')
      .eq('is_built_in', true)
      .order('created_at', { ascending: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (cancelled || !data) return
        setPresets(
          data
            .filter((a) => a.url)
            .map((a) => ({ id: a.id as string, url: a.url as string, label: (a.display_name ?? a.name ?? 'Preset') as string })),
        )
      })
    return () => { cancelled = true }
  }, [])

  if (presets.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted">Okuji presets</Label>
        <p className="text-xs text-muted">No preset grounds available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted">Okuji presets</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {presets.map((preset) => {
          const selected = page.background_image_url === preset.url
          return (
            <button
              key={preset.id}
              onClick={() => void persist({ background_image_url: preset.url })}
              className={`relative aspect-[3/4] w-full overflow-hidden rounded border-2 transition-colors ${
                selected ? 'border-green' : 'border-transparent hover:border-green/40'
              }`}
              title={preset.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preset.url} alt={preset.label} className="h-full w-full object-cover" />
            </button>
          )
        })}
      </div>
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
            <option value="okuji">Okuji preset</option>
            <option value="custom">Custom image</option>
            <option value="none">None</option>
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

        {/* Image-overlay controls — shared between Custom and Okuji
            preset because both write to background_image_url and
            render through PageBackground's image branch. The
            picker beneath swaps based on type. */}
        {(bg === 'custom' || bg === 'okuji') && (
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
            {bg === 'okuji'
              ? <OkujiPresetPicker page={page} persist={persist} />
              : <CustomBgPicker     page={page} persist={persist} />}
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
  const currentPassportId = usePassportStore((s) => s.passport?.id ?? null)
  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState<ImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadToLibrary, setUploadToLibrary] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void (async () => {
      const { data: { user } } = await (db as ReturnType<typeof createClient>).auth.getUser()
      if (!user) { setLoading(false); return }
      // Library-wide + current-passport-scoped only.
      let q = db
        .from('design_assets')
        .select('id, url, name, scoped_passport_id')
        .eq('asset_type', 'image')
        .eq('owner_id', user.id)
      q = currentPassportId
        ? q.or(`scoped_passport_id.is.null,scoped_passport_id.eq.${currentPassportId}`)
        : q.is('scoped_passport_id', null)
      const { data } = await q.order('created_at', { ascending: false })
      setAssets((data ?? []) as ImageAsset[])
      setLoading(false)
    })()
  }, [currentPassportId])

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
        {
          asset_type:         'image',
          url:                publicUrl,
          storage_path:       path,
          name:               file.name,
          owner_id:           user.id,
          scoped_passport_id: uploadToLibrary ? null : currentPassportId,
        },
        'id, url, name, scoped_passport_id',
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
      <UploadScopeToggle
        checked={uploadToLibrary}
        onChange={setUploadToLibrary}
        disabled={uploading || !currentPassportId}
      />
    </div>
  )
}

// Lists layout (table/grid) assets — the okuji built-in library plus the
// creator's own uploads — for the layout element. Same structure as
// ImageElementPicker; the differences are the asset_type filter, the
// built-in group (layouts are primarily okuji-supplied art), and the
// aspect snap: picking a layout re-derives the element's height from the
// asset's native ratio so thin-line art lands undistorted.

interface LayoutAsset {
  id: string
  url: string
  name: string | null
  is_built_in: boolean | null
  width_px: number | null
  height_px: number | null
}

function LayoutElementPicker({
  element,
  persist,
}: {
  element: LayoutPageElement
  persist: (patch: Partial<LayoutPageElement>) => Promise<void>
}) {
  const currentPassportId = usePassportStore((s) => s.passport?.id ?? null)
  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState<LayoutAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadToLibrary, setUploadToLibrary] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void (async () => {
      const { data: { user } } = await (db as ReturnType<typeof createClient>).auth.getUser()
      if (!user) { setLoading(false); return }
      // Built-in okuji layouts + own (library-wide or this-passport-scoped).
      let q = db
        .from('design_assets')
        .select('id, url, name, is_built_in, width_px, height_px, scoped_passport_id, owner_id')
        .eq('asset_type', 'layout')
        .or(`owner_id.eq.${user.id},is_built_in.eq.true`)
      q = currentPassportId
        ? q.or(`scoped_passport_id.is.null,scoped_passport_id.eq.${currentPassportId}`)
        : q.is('scoped_passport_id', null)
      const { data } = await q.order('created_at', { ascending: true })
      setAssets((data ?? []) as LayoutAsset[])
      setLoading(false)
    })()
  }, [currentPassportId])

  const pick = (asset: LayoutAsset) => {
    const patch: Partial<LayoutPageElement> = { imageUrl: asset.url }
    if (asset.width_px && asset.height_px) {
      // Snap height to the asset's native ratio at the current width.
      patch.height = Math.round(element.width * (asset.height_px / asset.width_px))
    }
    void persist(patch)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Through /api/assets/upload (same route as the Assets section) so
      // the row gets its metadata (dimensions, format) captured — the
      // aspect snap above depends on width_px/height_px.
      const form = new FormData()
      form.append('file', file)
      form.append('asset_type', 'layout')
      form.append('name', file.name)
      if (!uploadToLibrary && currentPassportId) form.append('scoped_passport_id', currentPassportId)
      const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        usePassportStore.getState().setSaveError(`Upload failed: ${body.error ?? res.statusText}`)
        return
      }
      const asset = await res.json() as LayoutAsset
      setAssets((prev) => [...prev, asset])
      pick(asset)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const builtIn = assets.filter((a) => a.is_built_in === true)
  const own = assets.filter((a) => a.is_built_in !== true)

  const grid = (rows: LayoutAsset[], deletable: boolean) => (
    <div className="mt-1 grid grid-cols-2 gap-1.5">
      {rows.map((asset) => (
        <div key={asset.id} className="group relative">
          <button
            type="button"
            onClick={() => pick(asset)}
            title={asset.name ?? ''}
            className={`relative w-full overflow-hidden rounded-card border bg-paper transition-colors ${
              element.imageUrl === asset.url
                ? 'border-green ring-1 ring-green'
                : 'border-hairline hover:border-green/40'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={asset.name ?? ''} className="h-20 w-full object-contain p-1" />
          </button>
          {deletable && (
            <AssetDeleteButton
              assetId={asset.id}
              assetName={asset.name ?? 'Untitled'}
              onDeleted={() => setAssets((prev) => prev.filter((a) => a.id !== asset.id))}
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-2">
      {!loading && builtIn.length > 0 && (
        <div>
          <Label className="text-xs text-muted">okuji layouts</Label>
          {grid(builtIn, false)}
        </div>
      )}
      {!loading && own.length > 0 && (
        <div>
          <Label className="text-xs text-muted">Your layouts</Label>
          {grid(own, true)}
        </div>
      )}
      {!loading && assets.length === 0 && (
        <p className="text-xs text-muted">No layouts yet — upload an SVG below.</p>
      )}

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border border-hairline px-3 py-2 text-xs transition-colors ${
          uploading ? 'pointer-events-none opacity-50' : 'text-muted hover:border-green/40'
        }`}
      >
        <input type="file" accept="image/svg+xml,image/png" className="hidden" onChange={handleUpload} disabled={uploading} />
        {uploading ? 'Uploading…' : '+ Upload layout'}
      </label>
      <UploadScopeToggle
        checked={uploadToLibrary}
        onChange={setUploadToLibrary}
        disabled={uploading || !currentPassportId}
      />
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

      {element.type === 'layout' && (
        <Section title="Layout">
          <LayoutElementPicker
            element={element as LayoutPageElement}
            persist={(patch) => persist(patch as Partial<DesignerPageElement>)}
          />
          <Field label={`Opacity: ${(element as LayoutPageElement).opacity ?? 100}%`}>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={(element as LayoutPageElement).opacity ?? 100}
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

      {element.type === 'richtext' && (
        <RichTextSection
          pageId={pageId}
          element={element}
          updateElement={updateElement}
          persist={persist}
        />
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

        {/* Rotation — text, image, and layout only */}
        {(element.type === 'text' || element.type === 'image' || element.type === 'layout') && (
          <Field label="Rotation (°)">
            <Input
              type="number"
              min={0}
              max={359}
              value={(element as TextPageElement | ImagePageElement | LayoutPageElement).rotation ?? 0}
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

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  // Collapsible accordion section; open/closed persists per title.
  const [open, setOpen] = usePersistentBool(`okuji.designer.section.${title}`, defaultOpen)
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:text-navy"
      >
        <span>{title}</span>
        <span aria-hidden="true" className={cn('text-sm leading-none transition-transform', open ? 'rotate-90' : 'rotate-0')}>
          ›
        </span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
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

// ── Rich-text inspector section ──────────────────────────────────────────────
// In-browser editor for richtext elements. Uses a contentEditable div +
// document.execCommand for B/I/U toggling on the active selection. Yes,
// execCommand is deprecated — for a B/I/U toolbar with a tight DOM-to-runs
// parser as the safety net, it's still the smallest-correct code path. The
// modern alternative is a third-party rich-text framework (TipTap, Slate);
// neither is justified for the v1 scope.
//
// Lifecycle:
//   1. Mount → seed editor.innerHTML from runsToHtml(initialRuns). After
//      that we DO NOT re-seed on prop change, because every keystroke
//      would otherwise reset the cursor. We re-seed only when the element
//      id changes (designer selected a different block) or when a re-pull
//      from the linked stop fires.
//   2. User types / hits the B/I/U toolbar / pastes / etc.
//   3. On blur → domToRuns(editor) → persist(). Adjacent runs with
//      identical styles get merged by the parser, keeping storage tidy.
//
// Address pre-fill:
//   - "Pull stop address" reads the LIVE stop row (matched by linkedStopId,
//     or — if unset — by a dropdown that lists every stop on this page).
//     It REPLACES the editor's current content with the freshly-formatted
//     address. Confirms first so the designer doesn't lose styling work
//     by accident.

function RichTextSection({
  pageId,
  element,
  updateElement,
  persist,
}: {
  pageId: string
  element: RichTextPageElement
  updateElement: (pageId: string, elementId: string, patch: Partial<DesignerPageElement>) => void
  persist: (patch: Partial<DesignerPageElement>) => Promise<void>
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const stops = usePassportStore((s) => s.stops)
  const stopsOnPage = stops.filter((s) => s.page_id === pageId)

  // Seed only on element-id change. Repeated re-seeds would reset the
  // cursor on every keystroke (the parent re-renders when persist() flows
  // back into the store).
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = runsToHtml(element.runs) || ''
  }, [element.id])

  function flush() {
    if (!editorRef.current) return
    const runs = domToRuns(editorRef.current)
    updateElement(pageId, element.id, { runs } as Partial<DesignerPageElement>)
    void persist({ runs } as Partial<DesignerPageElement>)
  }

  function exec(cmd: 'bold' | 'italic' | 'underline') {
    editorRef.current?.focus()
    // execCommand returns false in some browsers but still mutates the
    // selection. We don't depend on the return value — the next flush()
    // reads the DOM as the truth.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false)
    flush()
  }

  function pullAddress(stopId: string) {
    const stop = stopsOnPage.find((s) => s.id === stopId)
    if (!stop) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = stopAddressToRuns(stop as any)
    if (runs.length === 0) {
      window.alert('That stop has no address fields filled in yet. Add street / city / state on the stop first.')
      return
    }
    if (!window.confirm('Replace the current block contents with this stop’s address?')) return
    if (editorRef.current) {
      editorRef.current.innerHTML = runsToHtml(runs)
    }
    updateElement(pageId, element.id, { runs, linkedStopId: stop.id } as Partial<DesignerPageElement>)
    void persist({ runs, linkedStopId: stop.id } as Partial<DesignerPageElement>)
  }

  return (
    <Section title="Text block">
      <Field label="Content">
        <div className="space-y-1.5">
          <div className="flex gap-1">
            <ToolbarButton onClick={() => exec('bold')}      label="B" title="Bold (selection)" weight="bold" />
            <ToolbarButton onClick={() => exec('italic')}    label="I" title="Italic (selection)" italic />
            <ToolbarButton onClick={() => exec('underline')} label="U" title="Underline (selection)" underlined />
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={flush}
            // Match the canvas + holder render so what-you-see-is-what-you-get.
            className="min-h-[80px] w-full rounded-panel border border-hairline bg-paper px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-green focus:border-green whitespace-pre-wrap break-words"
            style={{
              fontFamily: element.fontFamily ?? 'Arial, sans-serif',
              fontSize:   element.fontSize   ?? 13,
              color:      `#${element.color  ?? '0D1B2A'}`,
              textAlign:  element.align      ?? 'left',
              lineHeight: 1.3,
            }}
          />
          <p className="text-[10.5px] text-muted">
            Multi-line, wraps. Select text + tap <strong>B</strong> / <em>I</em> /{' '}
            <u>U</u> to format. Holders see the same styling.
          </p>
        </div>
      </Field>

      {/* Stop-address pre-fill */}
      <Field label="Pull stop address">
        {stopsOnPage.length === 0 ? (
          <p className="text-[11px] text-muted">Add a stop to this page first.</p>
        ) : (
          <div className="space-y-1">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v) pullAddress(v)
                e.currentTarget.value = ''
              }}
              className="h-8 w-full rounded-panel border border-hairline px-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
            >
              <option value="">
                {element.linkedStopId
                  ? `Re-pull (linked: ${stopsOnPage.find((s) => s.id === element.linkedStopId)?.name ?? 'unknown'})`
                  : 'Choose a stop…'}
              </option>
              {stopsOnPage.map((s) => (
                <option key={s.id} value={s.id}>{s.name || 'Untitled stop'}</option>
              ))}
            </select>
            <p className="text-[10.5px] text-muted">
              Replaces the block with the stop’s street, city/state/zip, and (non-US) country.
            </p>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (px)">
          <Input
            type="number"
            min={8}
            max={36}
            value={element.fontSize ?? 13}
            onChange={(e) => updateElement(pageId, element.id, { fontSize: Number(e.target.value) } as Partial<DesignerPageElement>)}
            onBlur={(e)   => persist({ fontSize: Number(e.target.value) } as Partial<DesignerPageElement>)}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Align">
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => persist({ align: a } as Partial<DesignerPageElement>)}
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
      </div>

      <Field label="Color">
        <div className="flex gap-2">
          <Input
            value={element.color ?? '0D1B2A'}
            maxLength={6}
            onChange={(e) => updateElement(pageId, element.id, { color: e.target.value } as Partial<DesignerPageElement>)}
            onBlur={(e)   => void persist({ color: e.target.value } as Partial<DesignerPageElement>)}
            className="h-8 flex-1 font-mono text-sm uppercase"
          />
          <ColorPickerInput
            value={element.color ?? '0D1B2A'}
            onChange={(hex) => updateElement(pageId, element.id, { color: hex } as Partial<DesignerPageElement>)}
            onCommit={(hex) => void persist({ color: hex } as Partial<DesignerPageElement>)}
          />
        </div>
      </Field>
    </Section>
  )
}

function ToolbarButton({
  onClick, label, title, weight, italic, underlined,
}: {
  onClick: () => void
  label: string
  title: string
  weight?: 'bold'
  italic?: boolean
  underlined?: boolean
}) {
  return (
    <button
      type="button"
      // mousedown (not click) so the editor's selection isn't lost to
      // the button receiving focus before execCommand runs.
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className="h-7 w-7 rounded-card border border-hairline bg-white text-sm text-navy hover:border-green hover:bg-cream"
      style={{
        fontWeight:     weight === 'bold' ? 700 : 500,
        fontStyle:      italic ? 'italic' : 'normal',
        textDecoration: underlined ? 'underline' : 'none',
      }}
    >
      {label}
    </button>
  )
}
