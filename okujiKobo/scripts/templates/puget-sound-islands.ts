import type { PassportTemplate } from './types'

// Islands of Puget Sound — ten islands tied together by ferries,
// bridges, and one boat-only stop. Addresses are island/town +
// WA only; lat/lng intentionally null throughout (Nathan will
// drop pins via the designer's map picker or the seeder's
// optional Google Places resolution when GOOGLE_MAPS_SERVER_KEY
// is set).
//
// SpendTier note: the brief asked for "the $50–150 tier" at the
// passport level. The codebase's tier vocabulary (migration 047)
// caps at `50_plus` ($50+ open-ended); `50_plus` is the closest
// bucket and absorbs the $50–150 ferry-stack reality the brief
// describes.
//
// Page / stop counts: 10 pages, 28 stops total (3,3,3,3,3,1,3,3,3,3).
//
// Page → island mapping
//   P1  Fidalgo (Anacortes side)
//   P2  Whidbey
//   P3  Camano
//   P4  Marrowstone & Indian
//   P5  Bainbridge
//   P6  Blake          — single stop, boat-only
//   P7  Vashon & Maury
//   P8  Fox
//   P9  Anderson
//   P10 Harstine

export const pugetSoundIslands: PassportTemplate = {
  title: 'Islands of Puget Sound',
  description:
    'Ten islands, four ferries, two bridges, one boat — the grand tour of Puget Sound, north to south.',
  passportType: 'location',
  expectedSpendTier: '50_plus',
  expectedSpendNote:
    'Ferry fares add up across the Sound; Blake Island requires boat or kayak access. ' +
    'Most stops themselves are free.',

  pages: [
    {
      title: 'Fidalgo',
      subtitle: 'The gateway',
      stops: [
        { kind: 'gps', name: 'Deception Pass Bridge Overlook',  address: { city: 'Anacortes', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Cap Sante Park, Anacortes',       address: { city: 'Anacortes', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Anacortes Mural & Maritime Walk', address: { city: 'Anacortes', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Whidbey',
      subtitle: 'Forts, bluffs & villages',
      stops: [
        { kind: 'gps', name: "Ebey's Landing National Historical Reserve", address: { city: 'Coupeville', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Fort Casey & Admiralty Head Lighthouse',     address: { city: 'Coupeville', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Langley Village',                            address: { city: 'Langley',    state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Camano',
      subtitle: 'The bridge island',
      stops: [
        { kind: 'gps', name: 'Cama Beach Historical State Park', address: { city: 'Camano Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Camano Island State Park',         address: { city: 'Camano Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Iverson Spit Preserve',            address: { city: 'Camano Island', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Marrowstone & Indian',
      subtitle: 'The forts of Admiralty Inlet',
      stops: [
        { kind: 'gps', name: 'Fort Flagler Historical State Park', address: { city: 'Nordland', state: 'WA' }, spend: 'free' },
        { kind: 'qr',  name: 'Nordland General Store',             address: { city: 'Nordland', state: 'WA' }, spend: 'under_5' },
        { kind: 'gps', name: 'Mystery Bay State Park',             address: { city: 'Nordland', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Bainbridge',
      subtitle: 'The Seattle ferry',
      stops: [
        { kind: 'gps', name: 'Bainbridge Island Museum of Art (BIMA)', address: { city: 'Bainbridge Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Japanese American Exclusion Memorial',   address: { city: 'Bainbridge Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Winslow Waterfront',                     address: { city: 'Bainbridge Island', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Blake',
      subtitle: 'By water only',
      stops: [
        { kind: 'gps', name: 'Blake Island Marine State Park', address: { city: 'Blake Island', state: 'WA' }, spend: '50_plus' },
      ],
    },
    {
      title: 'Vashon & Maury',
      subtitle: "The artists' island",
      stops: [
        { kind: 'gps', name: 'Point Robinson Lighthouse, Maury Island', address: { city: 'Vashon', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Vashon Town & Center for the Arts',       address: { city: 'Vashon', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'The Bike in the Tree',                    address: { city: 'Vashon', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Fox',
      subtitle: 'The quiet bridge island',
      stops: [
        { kind: 'gps', name: 'Fox Island Historical Society Museum', address: { city: 'Fox Island', state: 'WA' }, spend: 'under_5' },
        { kind: 'gps', name: 'Fox Island Sandspit',                  address: { city: 'Fox Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Fox Island Bridge Viewpoint',          address: { city: 'Fox Island', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Anderson',
      subtitle: 'The southernmost ferry',
      stops: [
        { kind: 'qr',  name: 'Steilacoom–Anderson Island Ferry',                address: { city: 'Steilacoom',     state: 'WA' }, spend: '5_to_15' },
        { kind: 'gps', name: 'Johnson Farm (Anderson Island Historical Society)', address: { city: 'Anderson Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: "Andy's Marine Park",                              address: { city: 'Anderson Island', state: 'WA' }, spend: 'free' },
      ],
    },
    {
      title: 'Harstine',
      subtitle: 'The South Sound finish',
      stops: [
        { kind: 'gps', name: 'Harstine Island State Park',  address: { city: 'Harstine Island', state: 'WA' }, spend: 'free' },
        { kind: 'gps', name: 'Jarrell Cove State Park',     address: { city: 'Harstine Island', state: 'WA' }, spend: 'free' },
        { kind: 'qr',  name: 'Wild Felid Advocacy Center',  address: { city: 'Shelton',         state: 'WA' }, spend: '15_to_50' },
      ],
    },
  ],
}
