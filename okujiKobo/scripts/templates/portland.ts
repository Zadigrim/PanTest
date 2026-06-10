import type { PassportTemplate } from './types'

// Every Direction · A Portland Passport — the showcase.
//
// "I knew what was in every direction."
//
// Six pages, all-GPS verification. Free + published so it lands in
// Explore the moment the seed completes. Image pre-rendering happens
// on the first designer-side Publish click; until then Explore falls
// back to live-render.
//
// Coordinate provenance:
//   REAL  — hand-entered approximate coords for well-known landmarks
//           (Multnomah Falls, OMSI, Powell's, etc.). Designer's map
//           picker can refine.
//   NULL  — left null for generic destinations ('Seaside', 'Long
//           Beach') and stops whose exact pin would be a guess.
//           Designer fills in via the map picker.
//
// Stamp art: every stop ships with the seeder defaults (📍 / green).
// Per-stop custom art (Claude Design's Portland set) gets swapped via
// the designer's Stamp picker — no template change required.

export const portland: PassportTemplate = {
  title: 'Every Direction · A Portland Passport',
  description: 'I knew what was in every direction.',
  passportType: 'location',
  expectedSpendTier: '15_50',
  isPublished: true,
  // Rose for City of Roses — distinct from Bainbridge's compass.
  coverEmblem: '🌹',

  pages: [
    {
      title: 'East · The Gorge',
      stops: [
        { kind: 'gps', name: 'McMenamins Edgefield',         address: { city: 'Troutdale',     state: 'OR' }, lat: 45.5430, lng: -122.4030, spend: '15_to_50' },
        { kind: 'gps', name: 'Multnomah Falls',              address: { city: 'Bridal Veil',   state: 'OR' }, lat: 45.5762, lng: -122.1158, spend: 'free' },
        { kind: 'gps', name: 'Vista House at Crown Point',   address: { city: 'Corbett',       state: 'OR' }, lat: 45.5395, lng: -122.2447, spend: 'free' },
        { kind: 'gps', name: 'Eastwind Drive-In',            address: { city: 'Cascade Locks', state: 'OR' }, lat: 45.6691, lng: -121.8987, spend: 'under_5' },
        { kind: 'gps', name: 'Bridge of the Gods',           address: { city: 'Cascade Locks', state: 'OR' }, lat: 45.6614, lng: -121.9011, spend: 'under_5' },
        { kind: 'gps', name: 'Beacon Rock',                  address: { city: 'Skamania',      state: 'WA' }, lat: 45.6286, lng: -122.0214, spend: 'under_5' },
      ],
    },
    {
      title: 'South · The Valley',
      stops: [
        { kind: 'gps', name: 'Oregon State Fairgrounds',     address: { city: 'Salem',         state: 'OR' }, lat: 44.9519, lng: -123.0034, spend: '5_to_15' },
        { kind: 'gps', name: 'Silver Falls State Park',      address: { city: 'Sublimity',     state: 'OR' }, lat: 44.8773, lng: -122.6555, spend: 'under_5' },
        { kind: 'gps', name: 'Oregon State Capitol',         address: { city: 'Salem',         state: 'OR' }, lat: 44.9382, lng: -123.0301, spend: 'free' },
        // Stoller Family Estate — a Dundee Hills Willamette Valley
        // landmark, picked for the "a winery" placeholder so the
        // passport names a real destination.
        { kind: 'gps', name: 'Stoller Family Estate',        address: { city: 'Dayton',        state: 'OR' }, lat: 45.2606, lng: -123.0742, spend: '15_to_50' },
      ],
    },
    {
      title: 'West · The Coast',
      stops: [
        { kind: 'gps', name: 'Tillamook Creamery',           address: { city: 'Tillamook',     state: 'OR' }, lat: 45.4651, lng: -123.8443, spend: '5_to_15' },
        // Seaside / Astoria / Long Beach are towns, not pins — leave
        // lat/lng null so the designer's map picker sets the spot
        // the operator actually wants the stamp to anchor on.
        { kind: 'gps', name: 'Seaside',                      address: { city: 'Seaside',       state: 'OR' }, spend: '5_to_15' },
        { kind: 'gps', name: 'Astoria',                      address: { city: 'Astoria',       state: 'OR' }, spend: '5_to_15' },
        { kind: 'gps', name: 'Long Beach',                   address: { city: 'Long Beach',    state: 'WA' }, spend: '5_to_15' },
      ],
    },
    {
      title: 'North · St. Helens',
      stops: [
        { kind: 'gps', name: 'Ape Caves',                    address: { city: 'Cougar',        state: 'WA' }, lat: 46.1108, lng: -122.2110, spend: 'under_5' },
        { kind: 'gps', name: 'Johnston Ridge Observatory',   address: { city: 'Toutle',        state: 'WA' }, lat: 46.2756, lng: -122.2167, spend: 'under_5' },
        { kind: 'gps', name: 'Lewis River Falls',            address: { city: 'Cougar',        state: 'WA' }, lat: 46.1538, lng: -121.9054, spend: 'free' },
        { kind: 'gps', name: 'Cedar Creek Grist Mill',       address: { city: 'Woodland',      state: 'WA' }, lat: 45.8517, lng: -122.6022, spend: 'free' },
      ],
    },
    {
      title: 'Portland · The City',
      stops: [
        { kind: 'gps', name: 'OMSI',                         address: { city: 'Portland',      state: 'OR' }, lat: 45.5083, lng: -122.6657, spend: '15_to_50' },
        { kind: 'gps', name: 'Oaks Amusement Park',          address: { city: 'Portland',      state: 'OR' }, lat: 45.4724, lng: -122.6620, spend: '5_to_15' },
        { kind: 'gps', name: 'Portland Japanese Garden',     address: { city: 'Portland',      state: 'OR' }, lat: 45.5187, lng: -122.7080, spend: '15_to_50' },
        { kind: 'gps', name: "Powell's City of Books",       address: { city: 'Portland',      state: 'OR' }, lat: 45.5232, lng: -122.6815, spend: 'under_5' },
        { kind: 'gps', name: 'Tom McCall Waterfront Park',   address: { city: 'Portland',      state: 'OR' }, lat: 45.5183, lng: -122.6707, spend: 'free' },
      ],
    },
    {
      title: 'Hidden Gems',
      stops: [
        // Mill Ends Park — world's smallest park, downtown PDX.
        { kind: 'gps', name: 'Mill Ends Park',               address: { city: 'Portland',      state: 'OR' }, lat: 45.5161, lng: -122.6731, spend: 'free' },
        { kind: 'gps', name: "The Witch's Castle",           address: { city: 'Portland',      state: 'OR' }, lat: 45.5328, lng: -122.7274, spend: 'free' },
        { kind: 'gps', name: 'Burnside Skatepark',           address: { city: 'Portland',      state: 'OR' }, lat: 45.5258, lng: -122.6648, spend: 'free' },
        { kind: 'gps', name: 'Mt. Tabor',                    address: { city: 'Portland',      state: 'OR' }, lat: 45.5111, lng: -122.5944, spend: 'free' },
        { kind: 'gps', name: 'Freakybuttrue Peculiarium',    address: { city: 'Portland',      state: 'OR' }, lat: 45.5391, lng: -122.6896, spend: 'under_5' },
      ],
    },
  ],
}
