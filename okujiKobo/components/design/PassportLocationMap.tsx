'use client'

// Passport location map (migration 112 data) — a read-only choropleth of the
// creator's library by country, with click-to-drill into subdivisions (US
// states at minimum). Counts are a client-side reduce over the SAME rows the
// list uses; no new query, no schema. Lazy-loaded (next/dynamic, ssr:false)
// from MyPassportsTable so the list view pays nothing for it.
//
// Joins: world geographies key by numeric ISO 3166-1 (→ alpha-2 via
// NUMERIC_TO_ALPHA2); US states key by FIPS (→ ISO 3166-2 via US_FIPS_TO_REGION).
// Topojson is vendored same-origin under /public/geo — no tiles, no API keys,
// no third-party fetches.
//
// Extensible drill: add a country to DRILL (its own topojson + id→region fn)
// and its subdivisions light up; everything else is additive.

import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import {
  NUMERIC_TO_ALPHA2, US_FIPS_TO_REGION, countryName, regionName,
} from '@/lib/design/locations'
import type { PassportRow } from './MyPassportsTable'

// Countries with a drill-down subdivision map. Additive — add an entry to model
// another country's regions.
const DRILL: Record<string, {
  label: string
  geoUrl: string
  geoIdToRegion: (geoId: string) => string | null
}> = {
  US: {
    label: 'United States',
    geoUrl: '/geo/states-10m.json',
    geoIdToRegion: (id) => US_FIPS_TO_REGION[id] ?? null,
  },
}
const WORLD_URL = '/geo/countries-110m.json'

interface Props {
  rows: PassportRow[]
  /** Filter the list to a country (no subdivision drill available). */
  onFilterCountry: (countryCode: string) => void
  /** Filter the list to a region (its country is derivable from the code). */
  onFilterRegion: (countryCode: string, regionCode: string) => void
}

interface Tip { label: string; count: number; x: number; y: number }

export default function PassportLocationMap({ rows, onFilterCountry, onFilterRegion }: Props) {
  // null = world view; a country code = that country's subdivision view.
  const [drill, setDrill] = useState<string | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  // Counts over the FULL library (independent of status/search) — "how many of
  // my passports are in each country / region".
  const { byCountry, byRegion, unsetCount } = useMemo(() => {
    const byCountry = new Map<string, number>()
    const byRegion = new Map<string, number>()
    let unset = 0
    for (const r of rows) {
      const c = r.passport.country ?? null
      if (!c) { unset++; continue }
      byCountry.set(c, (byCountry.get(c) ?? 0) + 1)
      const rg = r.passport.region ?? null
      if (rg) byRegion.set(rg, (byRegion.get(rg) ?? 0) + 1)
    }
    return { byCountry, byRegion, unsetCount: unset }
  }, [rows])

  const inDrill = drill !== null && !!DRILL[drill]

  // Count a geography (country or subdivision) resolves to, + its join key.
  const resolve = (geo: { id?: string | number }): { key: string | null; count: number } => {
    const id = String(geo.id ?? '')
    if (inDrill) {
      const region = DRILL[drill!].geoIdToRegion(id)
      return { key: region, count: region ? (byRegion.get(region) ?? 0) : 0 }
    }
    const alpha2 = NUMERIC_TO_ALPHA2[id] ?? null
    return { key: alpha2, count: alpha2 ? (byCountry.get(alpha2) ?? 0) : 0 }
  }

  const handleClick = (geo: { id?: string | number }) => {
    const id = String(geo.id ?? '')
    if (inDrill) {
      const region = DRILL[drill!].geoIdToRegion(id)
      if (region) onFilterRegion(drill!, region) // leaf → filter the list
      return
    }
    const alpha2 = NUMERIC_TO_ALPHA2[id] ?? null
    if (!alpha2) return
    if (DRILL[alpha2]) setDrill(alpha2)          // has subdivisions → drill in
    else onFilterCountry(alpha2)                 // no subdivisions → filter list
  }

  const geoUrl = inDrill ? DRILL[drill!].geoUrl : WORLD_URL

  return (
    <div className="relative rounded-panel border border-hairline bg-white p-3">
      {/* Breadcrumb + "No location set" chip */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Map location">
          <button
            type="button"
            onClick={() => setDrill(null)}
            disabled={!inDrill}
            className={`font-medium transition-colors ${inDrill ? 'text-green hover:underline' : 'text-ink'}`}
          >
            World
          </button>
          {inDrill && (
            <>
              <span className="text-muted" aria-hidden="true">▸</span>
              <span className="text-ink">{DRILL[drill!].label}</span>
            </>
          )}
        </nav>
        <span
          className="shrink-0 rounded-full border border-hairline bg-cream px-2.5 py-1 text-[11px] font-medium text-muted"
          title="Passports with no country set — can't be placed on the map"
        >
          No location set: {unsetCount}
        </span>
      </div>

      {inDrill && (
        <button
          type="button"
          onClick={() => setDrill(null)}
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-green hover:underline"
        >
          ← Back to world
        </button>
      )}

      <div className="relative" onMouseLeave={() => setTip(null)}>
        <ComposableMap
          projection={inDrill ? 'geoAlbersUsa' : 'geoEqualEarth'}
          projectionConfig={inDrill ? { scale: 1000 } : { scale: 155 }}
          width={800}
          height={inDrill ? 450 : 400}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; id?: string | number }> }) =>
              geographies.map((geo) => {
                const { key, count } = resolve(geo)
                const shade = fillClass(count)
                const label =
                  inDrill
                    ? (key ? regionName(key) : '')
                    : (key ? countryName(key) : '')
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(e) => {
                      if (!label) { setTip(null); return }
                      setTip({ label, count, x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={(e) =>
                      setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
                    }
                    onMouseLeave={() => setTip(null)}
                    onClick={() => handleClick(geo)}
                    className={`${shade.className} outline-none transition-colors`}
                    style={{
                      default: { stroke: 'var(--map-stroke, #c8bfa9)', strokeWidth: 0.5, fillOpacity: shade.opacity, outline: 'none' },
                      hover: { stroke: 'var(--map-stroke-hover, #1f1d1a)', strokeWidth: 0.8, fillOpacity: Math.min(1, shade.opacity + 0.12), outline: 'none', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {tip && (
          <div
            className="pointer-events-none fixed z-50 rounded border border-hairline bg-ink px-2 py-1 text-[11px] text-cream shadow-md"
            style={{ left: tip.x + 12, top: tip.y + 12 }}
            role="status"
          >
            <span className="font-semibold">{tip.label}</span>
            <span className="ml-1.5 text-cream/80">
              {tip.count} passport{tip.count === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] italic text-muted">
        {inDrill
          ? 'Click a state to filter your passports to it.'
          : 'Shaded by passport count. Click the United States to see states; click another country to filter the list.'}
      </p>
    </div>
  )
}

// Choropleth ramp: neutral (cream) at zero, green at stepped opacity by count.
// className carries the token fill (no inline hex); opacity is a number, not a
// color, so the "tokens only" rule holds.
function fillClass(count: number): { className: string; opacity: number } {
  if (count <= 0) return { className: 'fill-cream', opacity: 1 }
  if (count === 1) return { className: 'fill-green', opacity: 0.3 }
  if (count <= 3) return { className: 'fill-green', opacity: 0.45 }
  if (count <= 5) return { className: 'fill-green', opacity: 0.62 }
  if (count <= 8) return { className: 'fill-green', opacity: 0.78 }
  return { className: 'fill-green', opacity: 0.92 }
}
