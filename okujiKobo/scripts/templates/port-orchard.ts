import type { PassportTemplate } from './types'

// Port Orchard Waterfront — downtown-waterfront passport for the POBSA pitch.
//
// Real businesses + landmarks across six blocks of the Bay Street / Harrison
// Ave waterfront, on four category pages. All stops are GPS (tier 3 via the
// migration-046 trigger): you stamp standing at the storefront / landmark.
//
// Coordinate provenance:
//   GEOCODED — address-bearing stops carry a `place` query the seeder resolves
//              ONCE at seed time (server-side Geocoding API) and caches on
//              stops.lat/lng. Runtime never re-geocodes.
//   PIN      — five hero landmarks have NO street address; seeded coord-null
//              and pinned by hand in the designer's map picker (Nathan).
//
// Currency: all 17 confirmed operating by Nathan (local) at seed time.
//
// Dedups folded in: "Sidney Museum & Arts Association" == "Sidney Art Gallery
// & Museum" (one stop); "Gathered by Josephine's" folded into "Josephine's
// Mercantile" (one stamp). Net 17.
//
// Shared pin: Mercantile Coffee Co. and Josephine's Mercantile both resolve to
// 702 Bay St — they'll geocode to the same point and need nudging apart in the
// map picker. Flagged in the seed report.
//
// spend tiers below are reasonable placeholders (per-stop, StopSpendTier) —
// adjust in the designer if wrong. Stamp art ships as seeder defaults
// (placeholder); Nathan's Claude Design assets swap in via the Stamp/cover
// picker, no re-seed.
//
// Seeds as a DRAFT (the publish-gate trigger needs a real auth.uid()); open in
// /design and click Publish once to push it live + render page images.

const CITY = 'Port Orchard'
const STATE = 'WA'
const ZIP = '98366'

export const portOrchard: PassportTemplate = {
  title: 'Port Orchard Waterfront',
  description: 'Six blocks of Puget Sound waterfront — eat, shop, and explore downtown Port Orchard.',
  passportType: 'location',
  expectedSpendTier: '15_50',
  coverEmblem: '⚓',

  pages: [
    {
      title: 'Waterfront & Landmarks',
      subtitle: 'Start at the water',
      stops: [
        // Hero landmarks — no street address; seeded coord-null, pinned in the
        // map picker. address carries city/state for display only (no `place`,
        // so the geocoder is not invoked).
        { kind: 'gps', name: 'Bay Street Pedestrian Path',        address: { city: CITY, state: STATE }, spend: 'free' },
        { kind: 'gps', name: 'Port Orchard Marina & Observation Deck', address: { city: CITY, state: STATE }, spend: 'free' },
        { kind: 'gps', name: 'Foot Ferry Dock',                   address: { city: CITY, state: STATE }, spend: 'under_5' },
        { kind: 'gps', name: 'The Gazebo',                        address: { city: CITY, state: STATE }, spend: 'free' },
        { kind: 'gps', name: 'Saturday Farmers Market',           address: { city: CITY, state: STATE }, spend: '5_to_15' },
        // Has an address → geocoded.
        { kind: 'gps', name: 'South Kitsap Regional Park',        address: { street: '2729 Jackson Ave SE', city: CITY, state: STATE, zip: ZIP }, place: '2729 Jackson Ave SE, Port Orchard, WA 98366', spend: 'free' },
      ],
    },
    {
      title: 'Eat & Drink',
      stops: [
        { kind: 'gps', name: "Amy's on the Bay",      address: { street: '100 Harrison Ave', city: CITY, state: STATE, zip: ZIP }, place: '100 Harrison Ave, Port Orchard, WA 98366', spend: '15_to_50' },
        { kind: 'gps', name: 'The Lighthouse',        address: { street: '130 Harrison Ave', city: CITY, state: STATE, zip: ZIP }, place: '130 Harrison Ave, Port Orchard, WA 98366', spend: '15_to_50' },
        { kind: 'gps', name: 'Carter And Company',    address: { street: '707 Bay St',       city: CITY, state: STATE, zip: ZIP }, place: '707 Bay St, Port Orchard, WA 98366',       spend: '5_to_15' },
        { kind: 'gps', name: 'The Coffee Oasis',      address: { street: '716 Bay St',       city: CITY, state: STATE, zip: ZIP }, place: '716 Bay St, Port Orchard, WA 98366',       spend: 'under_5' },
        { kind: 'gps', name: 'Mercantile Coffee Co.', address: { street: '702 Bay St',       city: CITY, state: STATE, zip: ZIP }, place: '702 Bay St, Port Orchard, WA 98366',       spend: 'under_5' },
      ],
    },
    {
      title: 'Shop',
      stops: [
        { kind: 'gps', name: "Josephine's Mercantile", address: { street: '702 Bay St', city: CITY, state: STATE, zip: ZIP }, place: '702 Bay St, Port Orchard, WA 98366', spend: '5_to_15' },
        { kind: 'gps', name: 'Revival',                address: { street: '701 Bay St', city: CITY, state: STATE, zip: ZIP }, place: '701 Bay St, Port Orchard, WA 98366', spend: '5_to_15' },
        { kind: 'gps', name: 'The Candy Shoppe',       address: { street: '833 Bay St', city: CITY, state: STATE, zip: ZIP }, place: '833 Bay St, Port Orchard, WA 98366', spend: 'under_5' },
      ],
    },
    {
      title: 'Do & See',
      stops: [
        { kind: 'gps', name: 'Sidney Art Gallery & Museum',           address: { street: '202 Sidney Ave', city: CITY, state: STATE, zip: ZIP }, place: '202 Sidney Ave, Port Orchard, WA 98366', spend: 'free' },
        { kind: 'gps', name: 'Western Washington Center for the Arts', address: { street: '624 Bay St',     city: CITY, state: STATE, zip: ZIP }, place: '624 Bay St, Port Orchard, WA 98366',     spend: '5_to_15' },
        { kind: 'gps', name: 'Veterans Memorial Park',                address: { street: '985 Retsil Rd SE', city: CITY, state: STATE, zip: ZIP }, place: '985 Retsil Rd SE, Port Orchard, WA 98366', spend: 'free' },
      ],
    },
  ],
}
