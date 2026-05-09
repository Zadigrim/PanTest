'use client'

import React from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  usePassportStore,
  selectActivePage,
  selectSelectedStop,
  selectSelectedElement,
} from '@/lib/stores/passport-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Stop, PassportPage, BackgroundType, PageElement, PassportType, DesignAsset } from '@/lib/supabase/types'

export function RightInspector() {
  const activePage = usePassportStore(selectActivePage)
  const selectedStop = usePassportStore(selectSelectedStop)
  const selectedElement = usePassportStore(selectSelectedElement)

  const label = selectedStop ? 'Stop'
    : selectedElement ? (selectedElement.type === 'text' ? 'Label' : selectedElement.type === 'hline' ? 'H-Line' : 'V-Line')
    : activePage ? 'Page'
    : 'Passport'

  const title = selectedStop ? selectedStop.name
    : selectedElement ? (selectedElement.content ?? '—')
    : activePage ? (activePage.section_title ?? activePage.section_name)
    : 'No selection'

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-panoply-gray-2 bg-white">
      <div className="border-b border-panoply-gray-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">{label}</p>
        <p className="truncate text-sm font-medium text-panoply-navy">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedStop ? (
          <StopInspector stop={selectedStop} />
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

// ── Stop Inspector ────────────────────────────────────────────────────────

const EVIDENCE_TIERS = [
  { tier: 1, label: 'Honor',      hint: 'Visitor self-reports being present' },
  { tier: 2, label: 'GPS',        hint: 'Phone confirms location within radius' },
  { tier: 3, label: 'QR Code',    hint: 'Scan a code posted at the site' },
  { tier: 4, label: 'Witnessed',  hint: 'Staff or host confirms visit' },
  { tier: 5, label: 'Documented', hint: 'Photo or receipt submitted' },
] as const

const PRESET_COLORS = [
  '1D9E75', '0D1B2A', 'C9A84C', 'D85A30',
  '7F77DD', '3A7BD5', 'B84C7D', '4CAF50',
  '9E4D1D', '6B6B6B',
]

const STAMP_ICONS = [
  // Food & drink
  '🍺','🍻','🥃','🍷','🍸','🍹','🍵','☕','🧋','🥂',
  // Places & travel
  '🏛️','⛪','🏰','🗺️','🧭','🏕️','🏠','🗼','🌉','⚓',
  // Nature
  '🌲','🌿','🍀','🌸','🌊','🏔️','🌋','🦋','🐝','🦅',
  // Activities & objects
  '🎭','🎨','🎸','🎯','🏆','🎖️','🔑','💎','📜','⭐',
  // Misc
  '📍','📌','🏷️','🎁','🎪','🎡','🎢','🚵','🧗','🌟',
]

const SMUDGE_OPTIONS = ['none', 'light', 'medium', 'heavy'] as const

function StopInspector({ stop }: { stop: Stop }) {
  const updateStop = usePassportStore((s) => s.updateStop)
  const removeStop = usePassportStore((s) => s.removeStop)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const [uploading, setUploading] = React.useState(false)

  const persist = async (patch: Partial<Stop>) => {
    updateStop(stop.id, patch)
    const supabase = createClient()
    await supabase.from('stops').update(patch).eq('id', stop.id)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `stops/${stop.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('stamp-images').upload(path, file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('stamp-images').getPublicUrl(path)
        await persist({ stamp_image_url: publicUrl })
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete stop "${stop.name}"?`)) return
    const supabase = createClient()
    await supabase.from('stops').delete().eq('id', stop.id)
    removeStop(stop.id)
    setSelectedStop(null)
  }

  const handleGenerateQR = async () => {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
    const token = `PANOPLY-${stop.id.slice(0, 8).toUpperCase()}-${rand}`
    await persist({ qr_code_token: token })
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

      <Section title="Verification">
        <div className="space-y-1.5">
          {EVIDENCE_TIERS.map(({ tier, label, hint }) => (
            <button
              key={tier}
              onClick={() => persist({ verification_tier: tier })}
              className={`w-full rounded-card border px-3 py-2 text-left transition-colors ${
                stop.verification_tier === tier
                  ? 'border-panoply-teal bg-panoply-teal-lt'
                  : 'border-panoply-gray-2 hover:border-panoply-teal/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${stop.verification_tier === tier ? 'text-panoply-teal-dk' : 'text-panoply-gray-3'}`}>
                  T{tier}
                </span>
                <span className={`text-sm font-medium ${stop.verification_tier === tier ? 'text-panoply-teal-dk' : 'text-panoply-navy'}`}>
                  {label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-panoply-gray-3">{hint}</p>
            </button>
          ))}
        </div>

        {(stop.verification_tier ?? 1) >= 2 && (
          <Field label="Radius (meters)">
            <Input
              type="number"
              value={stop.verification_radius_meters ?? 100}
              min={10}
              max={5000}
              onChange={(e) => updateStop(stop.id, { verification_radius_meters: Number(e.target.value) })}
              onBlur={(e) => persist({ verification_radius_meters: Number(e.target.value) })}
              className="h-8 text-sm"
            />
          </Field>
        )}
      </Section>

      {(stop.verification_tier ?? 1) >= 3 && (
        <Section title="QR Code">
          <div className="space-y-1.5">
            <Input
              value={stop.qr_code_token ?? ''}
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
        <Field label="Icon (emoji)">
          <Input
            value={stop.stamp_icon ?? '📍'}
            onChange={(e) => updateStop(stop.id, { stamp_icon: e.target.value })}
            onBlur={(e) => persist({ stamp_icon: e.target.value })}
            className="h-8 text-lg"
            maxLength={4}
          />
        </Field>
        <div>
          <Label className="text-xs text-panoply-gray-3">Quick pick</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {STAMP_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => persist({ stamp_icon: icon })}
                title={icon}
                className={`h-7 w-7 rounded-card border text-base leading-none transition-colors hover:border-panoply-teal ${
                  stop.stamp_icon === icon
                    ? 'border-panoply-teal bg-panoply-teal-lt'
                    : 'border-panoply-gray-2'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-panoply-gray-3">Color</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                onClick={() => persist({ stamp_color: hex })}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  stop.stamp_color === hex ? 'border-panoply-navy scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: `#${hex}` }}
                title={`#${hex}`}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-panoply-gray-3">Smudge</Label>
          <div className="mt-1.5 flex gap-1">
            {SMUDGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => persist({ smudge_intensity: opt })}
                className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                  stop.smudge_intensity === opt
                    ? 'border-panoply-teal bg-panoply-teal-lt text-panoply-teal-dk font-medium'
                    : 'border-panoply-gray-2 text-panoply-gray-3 hover:border-panoply-teal/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <Field label="Custom image (overrides emoji)">
          <div className="space-y-1.5">
            {stop.stamp_image_url && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stop.stamp_image_url}
                  alt="stamp preview"
                  className="h-12 w-12 rounded-card border border-panoply-gray-2 object-contain bg-panoply-gray-1"
                />
                <button
                  onClick={() => persist({ stamp_image_url: null })}
                  className="text-xs text-panoply-coral hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            <label className={`flex items-center gap-2 cursor-pointer rounded-card border px-3 py-2 text-xs transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'border-panoply-gray-2 text-panoply-gray-3 hover:border-panoply-teal/40'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploading ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
        </Field>
      </Section>

      <Section title="Location">
        <Field label="Street address">
          <Input
            value={stop.address_street ?? ''}
            placeholder="123 Main St"
            onChange={(e) => updateStop(stop.id, { address_street: e.target.value })}
            onBlur={(e) => persist({ address_street: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <Input
              value={stop.address_city ?? ''}
              placeholder="Springfield"
              onChange={(e) => updateStop(stop.id, { address_city: e.target.value })}
              onBlur={(e) => persist({ address_city: e.target.value })}
              className="h-8 text-sm"
            />
          </Field>
          <Field label="State">
            <Input
              value={stop.address_state ?? ''}
              placeholder="IL"
              maxLength={2}
              onChange={(e) => updateStop(stop.id, { address_state: e.target.value.toUpperCase() })}
              onBlur={(e) => persist({ address_state: e.target.value.toUpperCase() })}
              className="h-8 text-sm uppercase"
            />
          </Field>
        </div>
        <Field label="ZIP code">
          <Input
            value={stop.address_zip ?? ''}
            placeholder="62701"
            maxLength={10}
            onChange={(e) => updateStop(stop.id, { address_zip: e.target.value })}
            onBlur={(e) => persist({ address_zip: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lat">
            <Input
              type="number"
              step="0.000001"
              value={stop.lat ?? ''}
              onChange={(e) => updateStop(stop.id, { lat: e.target.value ? Number(e.target.value) : null })}
              onBlur={(e) => persist({ lat: e.target.value ? Number(e.target.value) : null })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Lng">
            <Input
              type="number"
              step="0.000001"
              value={stop.lng ?? ''}
              onChange={(e) => updateStop(stop.id, { lng: e.target.value ? Number(e.target.value) : null })}
              onBlur={(e) => persist({ lng: e.target.value ? Number(e.target.value) : null })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
      </Section>

      <Section title="Experience">
        <Field label="Type">
          <select
            value={stop.experience_type ?? ''}
            onChange={(e) => persist({ experience_type: (e.target.value || null) as Stop['experience_type'] })}
            className="h-8 w-full rounded-panel border border-panoply-gray-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-panoply-teal"
          >
            <option value="">— None —</option>
            <option value="location">Location visit</option>
            <option value="experience">Activity / experience</option>
          </select>
        </Field>
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

      <div className="border-t border-panoply-gray-2 pt-4">
        <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
          Delete stop
        </Button>
      </div>
    </div>
  )
}

// ── Custom background asset picker ────────────────────────────────────────

function CustomBgPicker({
  page,
  persist,
}: {
  page: PassportPage
  persist: (patch: Partial<PassportPage>) => Promise<void>
}) {
  const [assets, setAssets] = React.useState<DesignAsset[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    ;(supabase as any)
      .from('design_assets')
      .select('id, url, name, asset_type, storage_path, created_at')
      .eq('asset_type', 'background')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: DesignAsset[] | null }) => {
        setAssets(data ?? [])
        setLoading(false)
      })
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
      const { error: upErr } = await supabase.storage
        .from('design-assets')
        .upload(path, file)
      if (upErr) { console.error(upErr); return }
      const { data: { publicUrl } } = supabase.storage
        .from('design-assets')
        .getPublicUrl(path)
      const { data: asset } = await (supabase as any)
        .from('design_assets')
        .insert({ asset_type: 'background', url: publicUrl, storage_path: path, name: file.name })
        .select('id, url, name, asset_type, storage_path, created_at')
        .single() as { data: DesignAsset | null }
      if (asset) {
        setAssets((prev) => [asset, ...prev])
        await persist({ background_image_url: asset.url })
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-panoply-gray-3">Background image</Label>

      {loading ? (
        <p className="text-xs text-panoply-gray-3">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-xs text-panoply-gray-3">No backgrounds uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => persist({ background_image_url: asset.url })}
              className={`relative aspect-video overflow-hidden rounded border-2 transition-colors ${
                page.background_image_url === asset.url
                  ? 'border-panoply-teal'
                  : 'border-transparent hover:border-panoply-teal/40'
              }`}
              title={asset.name ?? ''}
            >
              <img
                src={asset.url ?? ''}
                alt={asset.name ?? ''}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border border-panoply-gray-2 px-3 py-2 text-xs transition-colors ${
          uploading
            ? 'pointer-events-none opacity-50'
            : 'text-panoply-gray-3 hover:border-panoply-teal/40'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? 'Uploading…' : '+ Upload background'}
      </label>
    </div>
  )
}

// ── Page Inspector ────────────────────────────────────────────────────────

function PageInspector({ page }: { page: PassportPage }) {
  const updatePage = usePassportStore((s) => s.updatePage)

  const persist = async (patch: Partial<PassportPage>) => {
    updatePage(page.id, patch)
    const supabase = createClient()
    const { error } = await supabase.from('passport_pages').update(patch).eq('id', page.id)
    if (error) console.error('[persist page]', error)
  }

  const bg = page.background_type

  return (
    <div className="space-y-5 p-4">
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
            onChange={(e) => persist({ background_type: e.target.value as BackgroundType })}
            className="h-8 w-full rounded-card border border-panoply-gray-2 bg-white px-2 text-xs text-panoply-gray-3 focus:border-panoply-teal focus:outline-none"
          >
            <option value="guilloche">Guilloche</option>
            <option value="grid">Grid</option>
            <option value="none">None</option>
            <option value="custom">Custom image</option>
            {/* keep landscape selectable if already set, but don't offer it as a new choice */}
            {bg === 'landscape' && <option value="landscape">Landscape (legacy)</option>}
          </select>
        </Field>

        <Field label="Paper color (hex, no #)">
          <div className="flex gap-2">
            <Input
              value={page.paper_color ?? 'F5F2EC'}
              maxLength={6}
              onChange={(e) => updatePage(page.id, { paper_color: e.target.value })}
              onBlur={(e) => persist({ paper_color: e.target.value })}
              className="h-8 flex-1 font-mono text-sm uppercase"
            />
            <div
              className="h-8 w-8 shrink-0 rounded-card border border-panoply-gray-2"
              style={{ backgroundColor: `#${page.paper_color ?? 'F5F2EC'}` }}
            />
          </div>
        </Field>

        {(bg === 'guilloche' || bg === 'grid') && (
          <>
            <Field label="Pattern color (hex, no #)">
              <div className="flex gap-2">
                <Input
                  value={page.background_color ?? '0D1B2A'}
                  maxLength={6}
                  onChange={(e) => updatePage(page.id, { background_color: e.target.value })}
                  onBlur={(e) => persist({ background_color: e.target.value })}
                  className="h-8 flex-1 font-mono text-sm uppercase"
                />
                <div
                  className="h-8 w-8 shrink-0 rounded-card border border-panoply-gray-2"
                  style={{ backgroundColor: `#${page.background_color ?? '0D1B2A'}` }}
                />
              </div>
            </Field>
            <Field label={`Opacity: ${page.background_opacity ?? 12}% (8–20)`}>
              <input
                type="range"
                min={8}
                max={20}
                value={page.background_opacity ?? 12}
                onChange={(e) => updatePage(page.id, { background_opacity: Number(e.target.value) })}
                onMouseUp={(e) => persist({ background_opacity: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-panoply-teal"
              />
            </Field>
          </>
        )}

        {bg === 'custom' && (
          <CustomBgPicker page={page} persist={persist} />
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
            onChange={(e) => updatePage(page.id, { prize_location_constraint: e.target.value })}
            onBlur={(e) => persist({ prize_location_constraint: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
      </Section>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────

const PASSPORT_TYPES: { value: PassportType; label: string; hint: string }[] = [
  { value: 'location',   label: 'Adventure',    hint: 'Visit physical places and landmarks' },
  { value: 'experience', label: 'Challenge',     hint: 'Complete activities or experiences' },
  { value: 'learning',   label: 'Educational',   hint: 'Learn and discover along the way' },
]

function PassportInspector() {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  if (!passport) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-panoply-gray-3">Loading…</p>
      </div>
    )
  }

  const persist = async (patch: Parameters<typeof updatePassport>[0]) => {
    updatePassport(patch)
    const supabase = createClient()
    await supabase.from('passports').update(patch).eq('id', passport.id)
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
            className="w-full rounded-panel border border-panoply-gray-2 bg-white px-3 py-2 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus:outline-none focus:ring-2 focus:ring-panoply-teal resize-none"
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
                (passport as any).passport_type === value
                  ? 'border-panoply-teal bg-panoply-teal-lt'
                  : 'border-panoply-gray-2 hover:border-panoply-teal/40'
              }`}
            >
              <p className={`text-sm font-medium ${(passport as any).passport_type === value ? 'text-panoply-teal-dk' : 'text-panoply-navy'}`}>
                {label}
              </p>
              <p className="mt-0.5 text-xs text-panoply-gray-3">{hint}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accessibility">
        {(['transit_accessible', 'wheelchair_accessible'] as const).map((field) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(passport as any)[field] ?? false}
              onChange={(e) => persist({ [field]: e.target.checked } as any)}
              className="accent-panoply-teal"
            />
            <span className="text-sm text-panoply-navy capitalize">
              {field === 'transit_accessible' ? 'Transit accessible' : 'Wheelchair accessible'}
            </span>
          </label>
        ))}
      </Section>
    </div>
  )
}

// ── Element Inspector ─────────────────────────────────────────────────────

const LABEL_COLORS = ['0D1B2A', '1D9E75', 'C9A84C', 'D85A30', '7F77DD', '888888']

function ElementInspector({ element, pageId }: { element: PageElement; pageId: string }) {
  const updateElement = usePassportStore((s) => s.updateElement)
  const removeElement = usePassportStore((s) => s.removeElement)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)
  const updatePage = usePassportStore((s) => s.updatePage)

  const persist = async (patch: Partial<PageElement>) => {
    const updated = updateElement(pageId, element.id, patch)
    const supabase = createClient()
    const { error } = await supabase.from('passport_pages').update({ elements: updated }).eq('id', pageId)
    if (error) console.error('[designer] elements save failed — is migration 017 applied?', error)
  }

  const handleDelete = async () => {
    const updated = removeElement(pageId, element.id)
    setSelectedElement(null)
    const supabase = createClient()
    const { error } = await supabase.from('passport_pages').update({ elements: updated }).eq('id', pageId)
    if (error) console.error('[designer] elements save failed — is migration 017 applied?', error)
  }

  return (
    <div className="space-y-5 p-4">
      {element.type === 'text' && (
        <>
          <Section title="Text">
            <Field label="Content">
              <Input
                value={element.content ?? ''}
                placeholder="Section header…"
                onChange={(e) => updateElement(pageId, element.id, { content: e.target.value })}
                onBlur={(e) => persist({ content: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Size (px)">
                <Input
                  type="number"
                  min={8}
                  max={72}
                  value={element.fontSize ?? 14}
                  onChange={(e) => updateElement(pageId, element.id, { fontSize: Number(e.target.value) })}
                  onBlur={(e) => persist({ fontSize: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </Field>
              <Field label="Weight">
                <select
                  value={element.fontWeight ?? 'normal'}
                  onChange={(e) => persist({ fontWeight: e.target.value as 'normal' | 'bold' })}
                  className="h-8 w-full rounded-panel border border-panoply-gray-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-panoply-teal"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </Field>
            </div>
            <Field label="Align">
              <div className="flex gap-1">
                {(['left','center','right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => persist({ align: a })}
                    className={`flex-1 rounded-card border py-1 text-xs capitalize transition-colors ${
                      (element.align ?? 'left') === a
                        ? 'border-panoply-teal bg-panoply-teal-lt text-panoply-teal-dk font-medium'
                        : 'border-panoply-gray-2 text-panoply-gray-3 hover:border-panoply-teal/40'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <div>
              <Label className="text-xs text-panoply-gray-3">Color</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => persist({ color: hex })}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      (element.color ?? '0D1B2A') === hex ? 'border-panoply-navy scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: `#${hex}` }}
                  />
                ))}
              </div>
            </div>
          </Section>
        </>
      )}

      {(element.type === 'hline' || element.type === 'vline') && (
        <Section title="Line">
          <Field label="Thickness (px)">
            <Input
              type="number"
              min={1}
              max={20}
              value={element.thickness ?? 2}
              onChange={(e) => updateElement(pageId, element.id, { thickness: Number(e.target.value) })}
              onBlur={(e) => persist({ thickness: Number(e.target.value) })}
              className="h-8 text-sm"
            />
          </Field>
          <div>
            <Label className="text-xs text-panoply-gray-3">Color</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LABEL_COLORS.map((hex) => (
                <button
                  key={hex}
                  onClick={() => persist({ lineColor: hex })}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    (element.lineColor ?? '0D1B2A') === hex ? 'border-panoply-navy scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `#${hex}` }}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title="Position">
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <Input type="number" value={Math.round(element.x)} onChange={(e) => updateElement(pageId, element.id, { x: Number(e.target.value) })} onBlur={(e) => persist({ x: Number(e.target.value) })} className="h-8 text-sm" />
          </Field>
          <Field label="Y">
            <Input type="number" value={Math.round(element.y)} onChange={(e) => updateElement(pageId, element.id, { y: Number(e.target.value) })} onBlur={(e) => persist({ y: Number(e.target.value) })} className="h-8 text-sm" />
          </Field>
          <Field label="W">
            <Input type="number" value={Math.round(element.width)} onChange={(e) => updateElement(pageId, element.id, { width: Number(e.target.value) })} onBlur={(e) => persist({ width: Number(e.target.value) })} className="h-8 text-sm" />
          </Field>
          <Field label="H">
            <Input type="number" value={Math.round(element.height)} onChange={(e) => updateElement(pageId, element.id, { height: Number(e.target.value) })} onBlur={(e) => persist({ height: Number(e.target.value) })} className="h-8 text-sm" />
          </Field>
        </div>
      </Section>

      <div className="border-t border-panoply-gray-2 pt-4">
        <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
          Delete element
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-panoply-gray-3">{label}</Label>
      {children}
    </div>
  )
}
