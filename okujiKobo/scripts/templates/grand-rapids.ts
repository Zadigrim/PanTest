import type { PassportTemplate } from './types'

// Downtown Grand Rapids · A Walkable Passport — a DEMO-published tester
// passport for a beta tester in the Grand Rapids area.
//
// 8 stops / 2 pages, clustered in the walkable downtown core (Monroe Center →
// the riverfront). Corner-to-corner is ~0.64 mi straight-line (~13–16 min on
// foot); a full stamping loop is ~1.2–1.5 mi. The Gerald R. Ford Museum sits
// across the Grand River but is reached on foot via the Blue Bridge (~8–9 min
// from Rosa Parks Circle), so it stays inside the cluster.
//
// DEMO-published (isDemo: true): any holder stamps regardless of GPS —
// verify-stamp checks and RECORDS the real proximity result (gps_verified) but
// does not enforce it (migrations 105/031). Lets a scattered tester complete
// the full loop from anywhere. Nathan-owned; not a marketplace passport.
//
// Coordinate provenance (Phase 0, web-verified):
//   lat/lng SET  — web-verified anchors (Rosa Parks Circle, Calder, Blue
//                  Bridge, Ford Museum, Children's Museum). Explicit values win
//                  over the geocoder in the seeder.
//   lat/lng OMITTED — address-derived stops (GRAM, Monroe Center, Public
//                  Museum) resolved precisely by the server geocoder from
//                  `place` at seed time; if GOOGLE_MAPS_SERVER_KEY is unset they
//                  seed null and get a pin via the designer map-picker. All
//                  three sit well inside the confirmed walkable box.
//
// Stamp art: seeder defaults (📍 / green). Real Design assets swap in later via
// the designer's Stamp picker — no template change. No baked landmark imagery.
//
// isPublished intentionally OMITTED — the publish-gate trigger (mig 045) calls
// auth.uid(), NULL under the seeder's service role, so a server-side publish
// fails. Open the seeded passport in /design and click Publish once (your
// session passes the gate; the image pipeline caches PNGs as a side effect).

export const grandRapids: PassportTemplate = {
  title: 'Downtown Grand Rapids · A Walkable Passport',
  description: 'Monroe Center to the riverfront, on foot.',
  passportType: 'location',
  expectedSpendTier: '15_50',
  coverEmblem: '🌉',
  isDemo: true,

  pages: [
    {
      title: 'Downtown Core',
      subtitle: 'Monroe Center',
      stops: [
        {
          kind: 'gps', name: 'Rosa Parks Circle',
          place: 'Rosa Parks Circle, Grand Rapids, MI',
          address: { street: '135 Monroe Center St NW', city: 'Grand Rapids', state: 'MI', zip: '49503' },
          lat: 42.9653, lng: -85.6715, radius: 150, spend: 'free',
        },
        {
          kind: 'gps', name: 'Grand Rapids Art Museum',
          place: 'Grand Rapids Art Museum, Grand Rapids, MI',
          address: { street: '101 Monroe Center St NW', city: 'Grand Rapids', state: 'MI', zip: '49503' },
          radius: 150, spend: '5_to_15', // lat/lng via geocoder
        },
        {
          kind: 'gps', name: 'Monroe Center',
          place: 'Monroe Center St NW, Grand Rapids, MI',
          address: { street: 'Monroe Center St NW', city: 'Grand Rapids', state: 'MI', zip: '49503' },
          radius: 150, spend: 'free', // lat/lng via geocoder
        },
        {
          kind: 'gps', name: 'Calder Plaza · La Grande Vitesse',
          place: 'Calder Plaza, Grand Rapids, MI',
          address: { street: '300 Monroe Ave NW', city: 'Grand Rapids', state: 'MI', zip: '49503' },
          lat: 42.9694, lng: -85.6711, radius: 150, spend: 'free',
        },
      ],
    },
    {
      title: 'The Riverfront',
      subtitle: 'Across the Blue Bridge',
      stops: [
        {
          kind: 'gps', name: 'Grand Rapids Public Museum',
          place: 'Grand Rapids Public Museum, Grand Rapids, MI',
          address: { street: '272 Pearl St NW', city: 'Grand Rapids', state: 'MI', zip: '49504' },
          radius: 150, spend: '5_to_15', // lat/lng via geocoder
        },
        {
          kind: 'gps', name: 'Blue Bridge',
          place: 'Blue Bridge, Grand Rapids, MI',
          address: { city: 'Grand Rapids', state: 'MI', zip: '49504' },
          lat: 42.9646, lng: -85.6770, radius: 150, spend: 'free',
        },
        {
          kind: 'gps', name: 'Gerald R. Ford Presidential Museum',
          place: 'Gerald R. Ford Presidential Museum, Grand Rapids, MI',
          address: { street: '303 Pearl St NW', city: 'Grand Rapids', state: 'MI', zip: '49504' },
          lat: 42.9686, lng: -85.6779, radius: 150, spend: '5_to_15',
        },
        {
          kind: 'gps', name: "Grand Rapids Children's Museum",
          place: "Grand Rapids Children's Museum, Grand Rapids, MI",
          address: { street: '11 Sheldon Ave NE', city: 'Grand Rapids', state: 'MI', zip: '49503' },
          lat: 42.9636, lng: -85.6672, radius: 150, spend: '5_to_15',
        },
      ],
    },
  ],
}
