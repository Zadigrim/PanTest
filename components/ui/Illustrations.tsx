// Branded UI illustrations, rendered from the SVG sources in assets/ui/.
//
// We render these via react-native-svg's <SvgXml> (inline strings) rather
// than importing the .svg files as components, because
// react-native-svg-transformer is intentionally NOT installed (the root
// lockfile is frozen for the pending Play submission). The strings below
// are kept verbatim in sync with their source files:
//
//   empty-shelf.svg   → EmptyShelf    (My Passports empty state)
//   empty-nearby.svg  → EmptyNearby   (Discover · Nearby empty state)
//   empty-journal.svg → EmptyJournal  (Journal entry empty state)
//   btn-stamp-ring.svg → StampRing    (dormant stamp-slot ring)
//
// The empty-state art uses the brand background palette (forest #1d4d2e,
// gold #c9a84c) so it reads as one deliberate set across surfaces. The
// stamp ring uses currentColor so each slot tints to its stop's
// stamp_color, matching the recoloring contract in StampArtwork.
import React from 'react'
import { SvgXml } from 'react-native-svg'

const EMPTY_SHELF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" fill="none"><path d="M140 56 L52 44 a6 6 0 0 0-7 6 v92 a6 6 0 0 0 5 6 l90 12z" fill="none" stroke="#1d4d2e" stroke-width="2" stroke-linejoin="round"></path><path d="M140 56 L228 44 a6 6 0 0 1 7 6 v92 a6 6 0 0 1-5 6 l-90 12z" fill="none" stroke="#1d4d2e" stroke-width="2" stroke-linejoin="round"></path><path d="M140 56 v110" stroke="#1d4d2e" stroke-width="2"></path><circle cx="96" cy="98" r="16" fill="none" stroke="#c9a84c" stroke-width="1.5" stroke-dasharray="2 5"></circle><circle cx="184" cy="98" r="16" fill="none" stroke="#1d4d2e" stroke-width="1.5" stroke-dasharray="2 5" stroke-opacity="0.5"></circle><path d="M74 130 h44 M162 130 h44" stroke="#1d4d2e" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round"></path></svg>`

const EMPTY_NEARBY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" fill="none"><path d="M60 168 h160" stroke="#1d4d2e" stroke-width="2" stroke-linecap="round"></path><path d="M70 150 q70-14 140 0" stroke="#1d4d2e" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round"></path><path d="M150 168 V58" stroke="#1d4d2e" stroke-width="2.5" stroke-linecap="round"></path><path d="M150 64 h44 l-9 11 9 11 h-44z" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linejoin="round"></path><path d="M150 92 H112 l-9 11 9 11 h38z" fill="none" stroke="#1d4d2e" stroke-width="2" stroke-linejoin="round"></path><path d="M40 120 l34-30 26 22 30-26 38 32" stroke="#1d4d2e" stroke-width="1.5" stroke-opacity="0.45" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="214" cy="70" r="11" stroke="#c9a84c" stroke-width="1.5" stroke-opacity="0.7"></circle></svg>`

const EMPTY_JOURNAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" fill="none"><rect x="86" y="40" width="92" height="120" rx="5" fill="none" stroke="#1d4d2e" stroke-width="2"></rect><path d="M86 52 h92 M86 160 v-120" stroke="#1d4d2e" stroke-width="1" stroke-opacity="0.4"></path><path d="M100 74 h64 M100 90 h64 M100 106 h48" stroke="#1d4d2e" stroke-width="1.5" stroke-opacity="0.35" stroke-linecap="round"></path><path d="M150 150 l52-52 14 14-52 52-18 4z" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linejoin="round"></path><path d="M196 104 l14 14" stroke="#c9a84c" stroke-width="2"></path><path d="M146 168 l4-18" stroke="#1d4d2e" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round"></path></svg>`

// currentColor-driven so the slot can tint it per stop. viewBox 0 0 96 96.
const STAMP_RING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none"><circle cx="48" cy="48" r="38" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"></circle><circle cx="48" cy="48" r="31" stroke="currentColor" stroke-width="1" stroke-opacity="0.5"></circle></svg>`

const ILLO_RATIO = 200 / 280 // height / width for the 280×200 empty-state art

/** Shared sizing for the three empty-state illustrations. */
function EmptyIllustration({ xml, width = 200 }: { xml: string; width?: number }) {
  return <SvgXml xml={xml} width={width} height={width * ILLO_RATIO} />
}

export function EmptyShelf({ width }: { width?: number }) {
  return <EmptyIllustration xml={EMPTY_SHELF_SVG} width={width} />
}

export function EmptyNearby({ width }: { width?: number }) {
  return <EmptyIllustration xml={EMPTY_NEARBY_SVG} width={width} />
}

export function EmptyJournal({ width }: { width?: number }) {
  return <EmptyIllustration xml={EMPTY_JOURNAL_SVG} width={width} />
}

/** Dormant stamp-slot ring. Tints to the stop's stamp_color via the same
 *  currentColor replacement StampArtwork uses; size fills the slot. */
export function StampRing({ size, color }: { size: number; color: string }) {
  const xml = STAMP_RING_SVG.replace(/currentColor/g, color)
  return <SvgXml xml={xml} width={size} height={size} />
}
