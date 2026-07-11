// Reusable sample-passport seeder.
//
// Usage (from okujiKobo/):
//   npm run seed:passport bainbridge
//
// Env vars required (in .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role bypasses RLS
//   SEED_CREATOR_ID              — your profiles.id (Auth → Users in Studio)
//
// Behaviour:
//   1. Looks up any existing passports for this creator with the
//      template's title and DELETES them (cascade drops pages + stops).
//   2. Inserts the passport, then pages in order, then stops per page.
//   3. Sets experience_type + experience_verification_method per stop
//      `kind`. Does NOT set verification_tier — migration 046's
//      BEFORE INSERT trigger derives it. Honor stops only set
//      experience_type='experience'; the trigger forces method='honor'
//      and tier=5.
//
// Adding a new template:
//   1. Create scripts/templates/<name>.ts exporting a PassportTemplate
//   2. Import + register it in TEMPLATES below
//   3. `npm run seed:passport <name>`

import { createClient } from '@supabase/supabase-js'
import type {
  PassportTemplate,
  StopTemplate,
  AddressFields,
} from './templates/types'
import { bainbridge } from './templates/bainbridge'
import { pugetSoundIslands } from './templates/puget-sound-islands'
import { portland } from './templates/portland'
import { portOrchard } from './templates/port-orchard'
import { grandRapids } from './templates/grand-rapids'
import { geocode, geocodeAvailable } from '@/lib/maps/server-geocode'
import type { ResolvedPlace } from '@/lib/maps/types'

const TEMPLATES: Record<string, PassportTemplate> = {
  bainbridge,
  'puget-sound-islands': pugetSoundIslands,
  portland,
  'port-orchard': portOrchard,
  'grand-rapids': grandRapids,
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

function mapKindToVerification(stop: StopTemplate): {
  experience_type: 'location' | 'experience'
  experience_verification_method: 'gps' | 'qr' | 'honor'
} {
  // Honor never sets the method — migration 046's trigger forces it to
  // 'honor' from experience_type='experience'. We send the canonical
  // value anyway so the row is consistent locally before the trigger.
  if (stop.kind === 'gps')   return { experience_type: 'location',   experience_verification_method: 'gps' }
  if (stop.kind === 'qr')    return { experience_type: 'location',   experience_verification_method: 'qr'  }
  return                            { experience_type: 'experience', experience_verification_method: 'honor' }
}

function expandAddress(
  addr: AddressFields | undefined,
): {
  address_street: string | null
  address_city:   string | null
  address_state:  string | null
  address_zip:    string | null
  country:        string | null
} {
  if (!addr) {
    return {
      address_street: null, address_city: null, address_state: null,
      address_zip: null,    country: null,
    }
  }
  const anySet =
    addr.street || addr.city || addr.state || addr.zip || addr.country
  return {
    address_street: addr.street ?? null,
    address_city:   addr.city   ?? null,
    address_state:  addr.state  ?? null,
    address_zip:    addr.zip    ?? null,
    // Default country when any address field is set and country wasn't
    // explicitly given. Templates can override (e.g. Mexico stops).
    country: addr.country ?? (anySet ? 'USA' : null),
  }
}

/** expandAddress, but with a fallback from a place-resolution result.
 *  Explicit AddressFields beat the resolver field-by-field; whatever
 *  the template DIDN'T set falls back to whatever Google found. */
function expandAddressMerged(
  addr: AddressFields | undefined,
  resolved: ResolvedPlace | null,
): {
  address_street: string | null
  address_city:   string | null
  address_state:  string | null
  address_zip:    string | null
  country:        string | null
} {
  const base = expandAddress(addr)
  if (!resolved) return base
  return {
    address_street: base.address_street ?? resolved.street  ?? null,
    address_city:   base.address_city   ?? resolved.city    ?? null,
    address_state:  base.address_state  ?? resolved.state   ?? null,
    address_zip:    base.address_zip    ?? resolved.zip     ?? null,
    country:        base.country        ?? resolved.country ?? null,
  }
}

async function main() {
  const which = process.argv[2]
  if (!which) {
    fail(
      `Usage: npm run seed:passport <template>\n` +
        `Available templates: ${Object.keys(TEMPLATES).join(', ')}`,
    )
  }
  if (!(which in TEMPLATES)) {
    fail(`Unknown template "${which}". Available: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key        = process.env.SUPABASE_SERVICE_ROLE_KEY
  const creatorId  = process.env.SEED_CREATOR_ID
  if (!url)       fail('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  if (!key)       fail('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  if (!creatorId) fail('Missing SEED_CREATOR_ID in .env.local (your profiles.id UUID)')

  const template = TEMPLATES[which]
  const sb = createClient(url!, key!, { auth: { persistSession: false } })

  console.log(`\nSeeding "${template.title}" for creator ${creatorId}\n`)

  // 1. Delete any existing passports with the same title for this creator.
  //    Cascade deletes their pages + stops (FK ON DELETE CASCADE).
  const { data: existing, error: findErr } = await sb
    .from('passports')
    .select('id')
    .eq('creator_id', creatorId!)
    .eq('title', template.title)
  if (findErr) fail(`Lookup of existing passports failed: ${findErr.message}`)

  if (existing && existing.length > 0) {
    const ids = existing.map((r: { id: string }) => r.id)
    console.log(`  Deleting ${ids.length} existing passport(s) with this title…`)
    const { error: delErr } = await sb.from('passports').delete().in('id', ids)
    if (delErr) fail(`Delete failed: ${delErr.message}`)
  }

  // 2. Insert the passport.
  // is_published / status / published_at honor the template's
  // optional isPublished flag. The image pipeline
  // (generateAndUploadPassportImages) is browser-only; for a
  // seeded-as-published passport, Explore falls back to live-render
  // until someone opens the passport in the designer and clicks
  // Publish (which runs the pipeline and caches PNGs).
  const publishNow = template.isPublished === true
  const { data: passportRow, error: passErr } = await sb
    .from('passports')
    .insert({
      creator_id:            creatorId!,
      title:                 template.title,
      description:           template.description ?? null,
      passport_type:         template.passportType,
      expected_spend_tier:   template.expectedSpendTier ?? null,
      expected_spend_note:   template.expectedSpendNote ?? null,
      cover_template:        'guilloche_blue',
      cover_paper_color:     'F5F2EC',
      cover_bg_color:        '0D1B2A',
      cover_emblem:          template.coverEmblem ?? '🧭',
      status:                publishNow ? 'published' : 'draft',
      is_published:          publishNow,
      published_at:          publishNow ? new Date().toISOString() : null,
      price_cents:           0,
      is_free:               true,
      transit_accessible:    false,
      wheelchair_accessible: false,
      // Demo-published tester passport (migration 105 admin/service guard).
      // The seeder runs as the service role (auth.uid() IS NULL), which the
      // guard permits, so is_demo=true is written directly at seed time.
      is_demo:               template.isDemo === true,
      // Every seeded template is an okuji curated sample, so it carries the
      // official mark (migration 107). Drives the back-cover QR in the print
      // pipeline regardless of price. Written at seed time under the service
      // role, which the migration-107 write guard permits.
      is_okuji_official:     true,
    })
    .select('id')
    .single()
  if (passErr || !passportRow) fail(`Passport insert failed: ${passErr?.message ?? 'no row'}`)
  const passportId = (passportRow as { id: string }).id
  console.log(`  ✓ Passport ${passportId}`)

  // 3. Insert pages in order. Sequential to preserve page_order and
  //    so an early failure surfaces a clean error instead of mid-batch
  //    partial state. The shared write chain in lib/design/persist
  //    doesn't apply here (this script is server-side), but the same
  //    "one row at a time" philosophy avoids the 57014 timeout pile-up
  //    we've fixed elsewhere.
  for (let pageIdx = 0; pageIdx < template.pages.length; pageIdx++) {
    const page = template.pages[pageIdx]
    const { data: pageRow, error: pgErr } = await sb
      .from('passport_pages')
      .insert({
        passport_id:        passportId,
        page_order:         pageIdx,
        page_type:          'stamp',
        section_name:       `Page ${pageIdx + 1}`,
        section_title:      page.title,
        section_subtitle:   page.subtitle ?? null,
        background_type:    'guilloche',
        background_color:   '0D1B2A',
        background_opacity: 100,
        // Intentional override of the system F5F2EC default — the
        // seeded passports use a white paper that's easier to overlay
        // photos / patterns on while arranging.
        paper_color:        'FFFFFF',
        elements:           [],
      })
      .select('id')
      .single()
    if (pgErr || !pageRow) fail(`Page ${pageIdx + 1} ("${page.title}") insert failed: ${pgErr?.message ?? 'no row'}`)
    const pageId = (pageRow as { id: string }).id
    console.log(`  ✓ Page ${pageIdx + 1}: ${page.title}`)

    // 4. Insert stops for this page.
    // Honor stops have no location; physical stops (gps/qr) MAY carry
    // a `place` query that the seeder resolves into address + lat/lng
    // when GOOGLE_MAPS_SERVER_KEY is configured. Explicit address /
    // lat / lng on the template always win over the resolver.
    const canGeocode = geocodeAvailable()
    if (!canGeocode) {
      console.log(
        '  · GOOGLE_MAPS_SERVER_KEY unset — skipping place resolution; ' +
          'lat/lng left null for any stops that relied on it.',
      )
    }

    for (let stopIdx = 0; stopIdx < page.stops.length; stopIdx++) {
      const stop = page.stops[stopIdx]
      const verification = mapKindToVerification(stop)

      // Try to resolve a `place` query into a structured result.
      // Failure (no key, ambiguous, ZERO_RESULTS, network) returns
      // null and the seed continues with whatever the template
      // explicitly provided.
      let resolved: ResolvedPlace | null = null
      if (stop.kind !== 'honor' && stop.place && canGeocode) {
        resolved = await geocode(stop.place)
        if (resolved) {
          console.log(`      ↳ resolved "${stop.place}" → (${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)})`)
        }
      }

      const addrFields =
        stop.kind === 'honor'
          ? expandAddress(undefined)
          : expandAddressMerged(stop.address, resolved)

      const row = {
        page_id:                        pageId,
        stop_order:                     stopIdx,
        name:                           stop.name,
        ...verification,
        expected_spend_tier:            stop.spend ?? null,
        verification_radius_meters:
          stop.kind === 'gps' ? (stop.radius ?? 100) : 100,
        ...addrFields,
        // Explicit lat/lng on the template wins over the resolver.
        // When both are absent, leave null — Nathan can drop a precise
        // pin via the designer's map picker.
        lat: stop.kind !== 'honor' ? (stop.lat ?? resolved?.lat ?? null) : null,
        lng: stop.kind !== 'honor' ? (stop.lng ?? resolved?.lng ?? null) : null,
        // Layout — 4-column grid mirroring LeftPalette.handleAddStop
        // so seeded stops land placed-but-arrangeable.
        box_x:      40 + (stopIdx % 4) * 130,
        box_y:      40 + Math.floor(stopIdx / 4) * 130,
        box_width:  120,
        box_height: 120,
        rotation:   0,
        // Stamp visual — designer defaults.
        stamp_icon:         '📍',
        stamp_color:        '1D9E75',
        stamp_type:         'emoji',
        stamp_rotation_min: -15,
        stamp_rotation_max: 15,
        smudge_intensity:   'none',
        // verification_tier deliberately omitted — derived by the
        // BEFORE INSERT trigger from migration 046.
      }

      const { error: stopErr } = await sb.from('stops').insert(row)
      if (stopErr) fail(`Stop "${stop.name}" insert failed: ${stopErr.message}`)
    }
    console.log(`      ${page.stops.length} stops`)
  }

  const totalStops = template.pages.reduce((n, p) => n + p.stops.length, 0)
  console.log(
    `\n✓ Seeded "${template.title}" — ${template.pages.length} pages, ${totalStops} stops.\n` +
      `  Open the designer's "My Passports" list to view.\n`,
  )
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e))
})
