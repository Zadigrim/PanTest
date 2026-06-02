import type { PassportTemplate } from './types'

// Bainbridge Island — first sample passport for the seeder.
//
// All stops have `address: { city, state }` only — no streets, no
// coordinates. Nathan will drop precise lat/lng via the map picker in
// the designer. The country defaults to 'USA' in the seeder when any
// address field is set.
//
// Stop counts: 8 pages × 3 stops = 24. Layout positions are auto-
// computed by the seeder so each stop lands in a 4-column grid on its
// page — placed-but-arrangeable.

const winslow = { city: 'Bainbridge Island', state: 'WA' } as const

export const bainbridge: PassportTemplate = {
  title: 'Bainbridge Island',
  description:
    "A ferry-ride day trip — Winslow's walkable downtown plus the island's gardens, forests, and wineries.",
  passportType: 'location',

  pages: [
    {
      title: 'The Arrival',
      stops: [
        { kind: 'qr',  name: 'WA State Ferry (Seattle ↔ Bainbridge)', address: winslow, spend: 'under_5' },
        { kind: 'gps', name: 'Eagle Harbor Waterfront Trail',          address: winslow, spend: 'free' },
        { kind: 'gps', name: 'Winslow Green',                          address: winslow, spend: 'free' },
      ],
    },
    {
      title: 'Art & Museums',
      stops: [
        { kind: 'gps', name: 'Bainbridge Island Museum of Art (BIMA)', address: winslow, spend: 'free' },
        { kind: 'gps', name: 'Bainbridge Island Historical Museum',    address: winslow, spend: 'free' },
        { kind: 'gps', name: 'Japanese American Exclusion Memorial',   address: winslow, spend: 'free' },
      ],
    },
    {
      title: 'Downtown Winslow Shops',
      stops: [
        { kind: 'qr',  name: 'Eagle Harbor Book Co.',     address: winslow, spend: 'free' },
        { kind: 'qr',  name: 'Churchmouse Yarns & Teas',  address: winslow, spend: 'free' },
        { kind: 'gps', name: 'Winslow Way Boutiques',     address: winslow, spend: 'free' },
      ],
    },
    {
      title: 'Cafés & Bakeries',
      stops: [
        { kind: 'qr', name: 'Blackbird Bakery',     address: winslow, spend: 'under_5' },
        { kind: 'qr', name: 'Pegasus Coffee House', address: winslow, spend: 'under_5' },
        { kind: 'qr', name: 'Bon Bon Confections',  address: winslow, spend: 'under_5' },
      ],
    },
    {
      title: 'The Winery Walk',
      stops: [
        { kind: 'qr', name: 'Eleven Winery (Winslow tasting room)', address: winslow, spend: '15_to_50' },
        { kind: 'qr', name: 'Fletcher Bay Winery',                   address: winslow, spend: '15_to_50' },
        { kind: 'qr', name: 'Eagle Harbor Wine Co.',                 address: winslow, spend: '15_to_50' },
      ],
    },
    {
      title: 'Waterfront Dining',
      stops: [
        { kind: 'qr', name: 'Harbour Public House',         address: winslow, spend: '15_to_50' },
        { kind: 'qr', name: "Doc's Marina Grill",           address: winslow, spend: '15_to_50' },
        { kind: 'qr', name: 'Bainbridge Brewing Alehouse',  address: winslow, spend: '5_to_15' },
      ],
    },
    {
      title: 'Gardens & Forest',
      stops: [
        { kind: 'gps', name: 'Bloedel Reserve',    address: winslow, spend: '15_to_50' },
        { kind: 'gps', name: 'The Grand Forest',   address: winslow, spend: 'free' },
        { kind: 'gps', name: 'Fort Ward Park',     address: winslow, spend: 'free' },
      ],
    },
    {
      title: 'Beyond Winslow',
      stops: [
        { kind: 'gps', name: 'Bainbridge Vineyards (Day Road)',    address: winslow, spend: '15_to_50' },
        { kind: 'gps', name: 'Bainbridge Island Farmers Market',   address: winslow, spend: 'free' },
        { kind: 'gps', name: 'The Barn / Day Road cluster',        address: winslow, spend: 'free' },
      ],
    },
  ],
}
